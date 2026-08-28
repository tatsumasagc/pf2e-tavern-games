const SUITS = [
  { id: "trees", label: "Trees", symbol: "♣" },
  { id: "ships", label: "Ships", symbol: "♠" },
  { id: "gems", label: "Gems", symbol: "♦" },
  { id: "parrots", label: "Parrots", symbol: "♥" },
];

const RANKS = [
  { rank: "A", label: "Ace", value: 14 },
  { rank: "2", label: "2", value: 2 },
  { rank: "3", label: "3", value: 3 },
  { rank: "4", label: "4", value: 4 },
  { rank: "5", label: "5", value: 5 },
  { rank: "6", label: "6", value: 6 },
  { rank: "7", label: "7", value: 7 },
  { rank: "8", label: "8", value: 8 },
  { rank: "9", label: "9", value: 9 },
  { rank: "10", label: "10", value: 10 },
  { rank: "J", label: "Jack", value: 11 },
  { rank: "Q", label: "Queen", value: 12 },
  { rank: "K", label: "King", value: 13 },
];

export const COPPER_PER_GOLD = 100;
export const PHASES = Object.freeze({
  DEAL: "deal",
  SELECT_COMMON: "select-common",
  BETTING: "betting",
  PLUNDER: "plunder",
  TRANSFER: "transfer",
  KEEP: "keep",
  COMPLETE: "complete",
});

export function cardLabel(card) {
  if (!card) return "Unknown card";
  if (card.pirate) return "Pirate";
  const suit = SUITS.find((entry) => entry.id === card.suit);
  const rank = RANKS.find((entry) => entry.rank === card.rank);
  return `${rank?.label ?? card.rank} of ${suit?.label ?? card.suit}`;
}

export function compactCardLabel(card) {
  if (!card) return "?";
  if (card.pirate) return "Pirate";
  const suit = SUITS.find((entry) => entry.id === card.suit);
  return `${card.rank}${suit?.symbol ?? ""}`;
}

function rankAssetName(rank) {
  if (rank === "A") return "01";
  if (rank === "J") return "jack";
  if (rank === "Q") return "queen";
  if (rank === "K") return "king";
  return String(rank).padStart(2, "0");
}

export function createDeck() {
  const deck = [];
  let sequence = 1;
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        id: `c-${sequence++}`,
        suit: suit.id,
        rank: rank.rank,
        value: rank.value,
        pirate: false,
        image: `assets/cards/${suit.id}_${rankAssetName(rank.rank)}.webp`,
      });
    }
  }
  deck.push({ id: `c-${sequence++}`, suit: null, rank: "P", value: 0, pirate: true, image: "assets/cards/pirate_1.webp" });
  deck.push({ id: `c-${sequence++}`, suit: null, rank: "P", value: 0, pirate: true, image: "assets/cards/pirate_2.webp" });
  return deck;
}

export function shuffle(cards, rng = Math.random) {
  const next = [...cards];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const target = Math.floor(rng() * (index + 1));
    [next[index], next[target]] = [next[target], next[index]];
  }
  return next;
}

export function copperToCoins(copper) {
  const amount = Math.max(0, Math.floor(Number(copper) || 0));
  const pp = Math.floor(amount / 1000);
  const gp = Math.floor((amount % 1000) / 100);
  const sp = Math.floor((amount % 100) / 10);
  const cp = amount % 10;
  return { pp, gp, sp, cp };
}

export function coinsToCopper({ pp = 0, gp = 0, sp = 0, cp = 0 } = {}) {
  const coins = { pp, gp, sp, cp };
  const multipliers = { pp: 1000, gp: 100, sp: 10, cp: 1 };
  let total = 0;
  for (const [denomination, amount] of Object.entries(coins)) {
    const numeric = Number(amount);
    assert(Number.isSafeInteger(numeric) && numeric >= 0, `${denomination} must be a non-negative whole number.`);
    total += numeric * multipliers[denomination];
  }
  assert(Number.isSafeInteger(total), "The coin total is too large.");
  return total;
}

export function formatCopper(copper) {
  const coins = copperToCoins(copper);
  const parts = [];
  if (coins.pp) parts.push(`${coins.pp} pp`);
  if (coins.gp) parts.push(`${coins.gp} gp`);
  if (coins.sp) parts.push(`${coins.sp} sp`);
  if (coins.cp || parts.length === 0) parts.push(`${coins.cp} cp`);
  return parts.join(" ");
}

function draw(deck, count) {
  if (deck.length < count) throw new Error("The deck does not contain enough cards to complete this action.");
  return { cards: deck.slice(0, count), deck: deck.slice(count) };
}

function playerById(state, id) {
  return state.players.find((player) => player.id === id) ?? null;
}

function orderedSeats(state, fromSeat = state.dealerSeat) {
  const seats = [];
  for (let offset = 0; offset < state.seatCount; offset += 1) seats.push((fromSeat + offset) % state.seatCount);
  return seats;
}

function memberBySeat(state, seat) {
  return state.seats.find((member) => member.seat === seat) ?? null;
}

function activePlayers(state) {
  return state.players.filter((player) => !player.folded);
}

function nextActiveSeat(state, fromSeat, pending = null) {
  for (let offset = 1; offset <= state.seatCount; offset += 1) {
    const candidate = (fromSeat + offset) % state.seatCount;
    const member = memberBySeat(state, candidate);
    if (!member || member.dummy) continue;
    const player = playerById(state, member.id);
    if (!player || player.folded) continue;
    if (!pending || pending.includes(player.id)) return candidate;
  }
  return null;
}

function commonBySeat(state, seat) {
  return state.common.find((entry) => entry.seat === seat) ?? null;
}

function revealedCommons(state) {
  return state.common.filter((entry) => entry.revealed).map((entry) => entry.card);
}

function cardFromPlayer(player, cardId) {
  return player.hand.find((card) => card.id === cardId) ?? null;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function cloneState(state) {
  return structuredClone(state);
}

function log(state, message, visibility = "public") {
  state.log.push({ at: Date.now(), message, visibility });
}

function returnRoundSummary(state, winners, scores) {
  state.lastShowdown = {
    winners: winners.map((player) => player.id),
    scores: Object.fromEntries(scores.map(({ player, score }) => [player.id, serialiseScore(score)])),
  };
}

function serialiseScore(score) {
  return { category: score.category, name: score.name, tiebreak: score.tiebreak, cards: score.cards.map((card) => card.id) };
}

function handScoreFromFive(cards) {
  const values = cards.map((card) => card.value).sort((a, b) => b - a);
  const countEntries = [...new Map(values.map((value) => [value, values.filter((other) => other === value).length])).entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || b.value - a.value);
  const flush = new Set(cards.map((card) => card.suit)).size === 1;
  const unique = [...new Set(values)].sort((a, b) => b - a);
  let straightHigh = null;
  if (unique.length === 5 && unique[0] - unique[4] === 4) straightHigh = unique[0];
  if (unique.length === 5 && unique.join(",") === "14,5,4,3,2") straightHigh = 5;
  const straight = straightHigh !== null;

  if (straight && flush) return { category: 8, name: "Straight Flush", tiebreak: [straightHigh], cards };
  if (countEntries[0].count === 4) return { category: 7, name: "Four of a Kind", tiebreak: [countEntries[0].value, countEntries[1].value], cards };
  if (countEntries[0].count === 3 && countEntries[1].count === 2) return { category: 6, name: "Full House", tiebreak: [countEntries[0].value, countEntries[1].value], cards };
  if (flush) return { category: 5, name: "Flush", tiebreak: values, cards };
  if (straight) return { category: 4, name: "Straight", tiebreak: [straightHigh], cards };
  if (countEntries[0].count === 3) return { category: 3, name: "Three of a Kind", tiebreak: [countEntries[0].value, ...countEntries.slice(1).map((entry) => entry.value)], cards };
  if (countEntries[0].count === 2 && countEntries[1].count === 2) return { category: 2, name: "Two Pair", tiebreak: [countEntries[0].value, countEntries[1].value, countEntries[2].value], cards };
  if (countEntries[0].count === 2) return { category: 1, name: "One Pair", tiebreak: [countEntries[0].value, ...countEntries.slice(1).map((entry) => entry.value)], cards };
  return { category: 0, name: "High Card", tiebreak: values, cards };
}

function compareScore(left, right) {
  if (left.category !== right.category) return left.category - right.category;
  const max = Math.max(left.tiebreak.length, right.tiebreak.length);
  for (let index = 0; index < max; index += 1) {
    const difference = (left.tiebreak[index] ?? 0) - (right.tiebreak[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function chooseCombinations(cards, count) {
  const result = [];
  const walk = (start, current) => {
    if (current.length === count) {
      result.push(current);
      return;
    }
    for (let index = start; index <= cards.length - (count - current.length); index += 1) walk(index + 1, [...current, cards[index]]);
  };
  walk(0, []);
  return result;
}

export function bestPokerHand(cards) {
  const validCards = cards.filter((card) => !card.pirate);
  assert(validCards.length >= 5, "At least five non-Pirate cards are required to score a hand.");
  return chooseCombinations(validCards, 5)
    .map(handScoreFromFive)
    .reduce((best, next) => (!best || compareScore(next, best) > 0 ? next : best), null);
}

function refreshPendingAndTurn(state, actedPlayerId, raised = false) {
  const activeIds = activePlayers(state).map((player) => player.id);
  if (raised) state.betting.pending = activeIds.filter((id) => id !== actedPlayerId);
  else state.betting.pending = state.betting.pending.filter((id) => id !== actedPlayerId);
  if (state.betting.pending.length === 0) return false;
  const acted = playerById(state, actedPlayerId);
  const candidate = nextActiveSeat(state, acted.seat, state.betting.pending);
  state.betting.turnSeat = candidate;
  return true;
}

function beginBetting(state, startSeat, { final = false } = {}) {
  state.phase = PHASES.BETTING;
  state.betting = {
    currentBet: 0,
    minRaise: state.anteCp,
    roundBets: Object.fromEntries(state.players.map((player) => [player.id, 0])),
    pending: activePlayers(state).map((player) => player.id),
    turnSeat: nextActiveSeat(state, (startSeat - 1 + state.seatCount) % state.seatCount),
    stage: final ? "final" : "common",
  };
  log(state, `Betting opens for ${final ? "the final betting phase" : `round ${state.round}`}.`);
}

function advanceReveal(state) {
  state.round += 1;
  const seat = orderedSeats(state)[state.round - 1];
  const common = commonBySeat(state, seat);
  assert(common, "A common card is missing from the table.");
  common.revealed = true;
  log(state, `${common.name} reveals ${cardLabel(common.card)} to the common pool.`);
  beginBetting(state, seat);
}

function buildPlunderQueue(state) {
  const queue = [];
  for (const seat of orderedSeats(state)) {
    const member = memberBySeat(state, seat);
    if (member?.dummy) continue;
    const player = playerById(state, member.id);
    for (const card of player.hand.filter((entry) => entry.pirate)) queue.push({ playerId: player.id, cardId: card.id });
  }
  return queue;
}

function advancePlunder(state) {
  state.plunder.index += 1;
  state.pendingPlunder = null;
  while (state.plunder.index < state.plunder.queue.length) {
    const step = state.plunder.queue[state.plunder.index];
    const player = playerById(state, step.playerId);
    if (player?.hand.some((card) => card.id === step.cardId)) break;
    state.plunder.index += 1;
  }
  if (state.plunder.index >= state.plunder.queue.length) {
    state.phase = PHASES.BETTING;
    state.betting = null;
    beginBetting(state, state.dealerSeat, { final: true });
  }
}

function highestCommonWinner(state, winners) {
  const revealed = revealedCommons(state).filter((card) => !card.pirate);
  if (revealed.length === 0) return winners[0];
  const highValue = Math.max(...revealed.map((card) => card.value));
  const owners = state.common.filter((entry) => entry.revealed && entry.card.value === highValue).map((entry) => entry.playerId).filter(Boolean);
  const candidates = state.players.filter((player) => owners.includes(player.id));
  if (candidates.length === 1) return candidates[0];
  if (candidates.length > 1 && state.lastShowdown?.scores) {
    const scoreById = state.lastShowdown.scores;
    return [...candidates].sort((left, right) => {
      const l = scoreById[left.id];
      const r = scoreById[right.id];
      if (!l || !r) return 0;
      return compareScore(l, r);
    }).at(-1);
  }
  const candidateIds = new Set(candidates.length ? candidates.map((player) => player.id) : winners.map((player) => player.id));
  for (const seat of orderedSeats(state, (state.dealerSeat + 1) % state.seatCount)) {
    const member = memberBySeat(state, seat);
    if (member && candidateIds.has(member.id)) return playerById(state, member.id);
  }
  return winners[0];
}

function beginKeeping(state, winners) {
  state.phase = PHASES.KEEP;
  state.keepers = Object.fromEntries(state.players.map((player) => [player.id, false]));
  state.winners = winners.map((player) => player.id);
  if (state.gameNumber === 1 && state.setAsidePirate) {
    const recipient = highestCommonWinner(state, winners);
    recipient.forcedCarry = [state.setAsidePirate];
    state.setAsidePirate = null;
    log(state, `${recipient.name} is awarded a Pirate card for the highest common card.`);
  }
  log(state, "Each player may now choose one card to keep for the next game. The round winner may keep a common card instead.");
}

function awardPot(state, winners) {
  const share = Math.floor(state.potCp / winners.length);
  const remainder = state.potCp % winners.length;
  state.payouts = winners.map((player) => ({ playerId: player.id, copper: share }));
  state.potCp = remainder;
  for (const player of winners) log(state, `${player.name} receives ${formatCopper(share)} from the pot.`);
  if (remainder) log(state, `${formatCopper(remainder)} remains in the pot for the next game.`);
  beginKeeping(state, winners);
}

function resolveFoldWin(state) {
  const winners = activePlayers(state);
  assert(winners.length === 1, "A fold win requires exactly one active player.");
  returnRoundSummary(state, winners, []);
  log(state, `${winners[0].name} wins the pot after every other player folds.`);
  awardPot(state, winners);
  return winners;
}

function allCommonsSelected(state) {
  return state.common.length === state.seatCount && state.common.every((entry) => entry.card);
}

export function dealNextGame(state, rng = Math.random) {
  const next = cloneState(state);
  assert(next.phase === PHASES.KEEP || next.phase === PHASES.COMPLETE, "The next game can only be prepared after keeping cards has concluded.");
  const carry = new Map();
  for (const player of next.players) {
    const forced = player.forcedCarry ?? [];
    const selection = next.keepers?.[player.id];
    const selectedCard = selection ? findCardAnywhere(next, selection) : null;
    assert(!selection || selectedCard, "A selected carry-over card could not be found.");
    carry.set(player.id, [...forced, ...(selectedCard ? [selectedCard] : [])]);
  }
  const carryIds = new Set([...carry.values()].flat().map((card) => card.id));
  const activeCards = [
    ...next.deck,
    ...next.players.flatMap((player) => player.hand),
    ...next.common.map((entry) => entry.card),
  ].filter((card) => card && !carryIds.has(card.id) && !next.discard.some((discard) => discard.id === card.id));
  next.deck = shuffle(activeCards, rng);
  next.common = [];
  next.round = 0;
  next.phase = PHASES.DEAL;
  next.betting = null;
  next.plunder = null;
  next.pendingPlunder = null;
  next.keepers = null;
  next.payouts = [];
  next.lastShowdown = null;
  next.cheatingDealerId = null;
  next.gameNumber += 1;
  const winner = next.winners?.[0] ? playerById(next, next.winners[0]) : null;
  if (winner) next.dealerSeat = winner.seat;
  next.winners = [];
  for (const player of next.players) {
    player.hand = carry.get(player.id);
    player.forcedCarry = [];
    player.folded = false;
    player.contributionCp = 0;
  }
  log(next, `Game ${next.gameNumber} is ready. ${memberBySeat(next, next.dealerSeat)?.name} is Poppy and must deal the cards.`);
  return next;
}

function findCardAnywhere(state, cardId) {
  for (const player of state.players) {
    const card = player.hand.find((entry) => entry.id === cardId);
    if (card) return card;
    const forced = (player.forcedCarry ?? []).find((entry) => entry.id === cardId);
    if (forced) return forced;
  }
  return state.common.find((entry) => entry.card?.id === cardId)?.card ?? null;
}

export function createGame({ participants, anteCp, dealerId, rng = Math.random }) {
  assert(Array.isArray(participants) && participants.length >= 2 && participants.length <= 4, "Choose between two and four players.");
  assert(Number.isInteger(anteCp) && anteCp >= 0, "The ante must be a whole number of copper pieces.");
  const deckOwner = participants.find((participant) => participant.id === dealerId || participant.actorId === dealerId);
  assert(deckOwner, "Choose one participating actor as the deck owner and first Poppy.");
  const otherParticipants = shuffle(participants.filter((participant) => participant !== deckOwner), rng);
  const playerSeats = [deckOwner, ...otherParticipants].map((participant, seat) => ({ ...participant, seat, dummy: false }));
  const seats = [...playerSeats];
  while (seats.length < 4) seats.push({ id: `dummy-${seats.length + 1}`, name: "Dummy player", seat: seats.length, dummy: true });
  const deck = shuffle(createDeck(), rng);
  const pirateIndex = deck.findIndex((card) => card.pirate);
  const [setAsidePirate] = deck.splice(pirateIndex, 1);
  const players = playerSeats.map((seat) => ({ id: seat.id, actorId: seat.actorId, name: seat.name, seat: seat.seat, hand: [], forcedCarry: [], folded: false, contributionCp: 0 }));
  const state = {
    version: 1,
    gameNumber: 1,
    seatCount: 4,
    seats,
    players,
    deck,
    discard: [],
    common: [],
    setAsidePirate,
    dealerSeat: 0,
    anteCp,
    potCp: 0,
    round: 0,
    phase: PHASES.DEAL,
    betting: null,
    plunder: null,
    pendingPlunder: null,
    keepers: null,
    winners: [],
    payouts: [],
    lastShowdown: null,
    cheatingDealerId: null,
    log: [],
  };
  log(state, `${memberBySeat(state, state.dealerSeat).name} owns the deck and is the first Poppy.`);
  log(state, "The deck is ready. Poppy must deal the cards before the first round begins.");
  return state;
}

export function dealPreparedGame(state, { markedCardIds = [], markedCardSight = false, rng = Math.random } = {}) {
  const next = cloneState(state);
  assert(next.phase === PHASES.DEAL, "Cards can only be dealt while the table is waiting for Poppy.");
  const dealer = playerById(next, memberBySeat(next, next.dealerSeat)?.id);
  assert(dealer, "The current Poppy is missing from the table.");
  const choices = Array.isArray(markedCardIds) ? markedCardIds.filter(Boolean) : [];
  assert(new Set(choices).size === choices.length, "Choose each marked card only once.");
  assert(next.gameNumber !== 1 || choices.length <= 2, "Poppy can choose at most two marked cards for the first game.");
  assert(choices.length === 0 || choices.length === 2, "Marked playing cards must select exactly two cards.");
  assert(next.gameNumber === 1 || choices.length === 0, "Marked-card choices are available only for the first game.");
  assert(typeof markedCardSight === "boolean", "Marked-card sight must be a true or false choice.");
  const marked = choices.map((cardId) => {
    const index = next.deck.findIndex((card) => card.id === cardId);
    assert(index >= 0, "A chosen marked card is not available in the deck.");
    return next.deck.splice(index, 1)[0];
  });
  next.deck = shuffle(next.deck, rng);
  next.cheatingDealerId = markedCardSight || marked.length === 2 ? dealer.id : null;
  dealer.hand.push(...marked);
  for (const seat of orderedSeats(next)) {
    const member = memberBySeat(next, seat);
    if (!member || member.dummy) continue;
    const player = playerById(next, member.id);
    const dealt = draw(next.deck, Math.max(0, 5 - player.hand.length));
    player.hand.push(...dealt.cards);
    player.contributionCp += next.anteCp;
    next.deck = dealt.deck;
  }
  for (const seat of next.seats.filter((entry) => entry.dummy)) {
    const dealt = draw(next.deck, 1);
    next.common.push({ seat: seat.seat, playerId: null, name: seat.name, card: dealt.cards[0], revealed: false, dummy: true });
    next.deck = dealt.deck;
  }
  next.potCp += next.anteCp * next.players.length;
  next.phase = PHASES.SELECT_COMMON;
  log(next, `${dealer.name} deals the cards for game ${next.gameNumber}.`);
  log(next, `Every player antes ${formatCopper(next.anteCp)}.`);
  return next;
}

export function selectCommon(state, playerId, cardId) {
  const next = cloneState(state);
  assert(next.phase === PHASES.SELECT_COMMON, "Common cards cannot be selected at this time.");
  const player = playerById(next, playerId);
  assert(player && !player.folded, "Only active players may select a common card.");
  assert(!next.common.some((entry) => entry.playerId === playerId), "This player has already selected a common card.");
  const cardIndex = player.hand.findIndex((card) => card.id === cardId);
  assert(cardIndex >= 0, "The selected card is not in the player’s hand.");
  const [card] = player.hand.splice(cardIndex, 1);
  next.common.push({ seat: player.seat, playerId, name: player.name, card, revealed: false, dummy: false });
  log(next, `${player.name} places a common card face-down.`);
  if (allCommonsSelected(next)) advanceReveal(next);
  return next;
}

export function bettingAction(state, playerId, action, amountCp = null) {
  const next = cloneState(state);
  assert(next.phase === PHASES.BETTING && next.betting, "Betting is not open.");
  const player = playerById(next, playerId);
  assert(player && !player.folded, "Only active players may act during betting.");
  assert(player.seat === next.betting.turnSeat, "It is not this player’s turn to bet.");
  const currentBet = next.betting.currentBet;
  const paid = next.betting.roundBets[playerId] ?? 0;
  let debitCp = 0;
  let raised = false;

  if (action === "pass") {
    assert(currentBet === 0, "A player may pass only before betting has opened.");
    log(next, `${player.name} passes.`);
  } else if (action === "call") {
    assert(currentBet > 0, "There is no bet to call; pass instead.");
    debitCp = currentBet - paid;
    assert(debitCp >= 0, "The player has already exceeded the current bet.");
    next.betting.roundBets[playerId] = currentBet;
    player.contributionCp += debitCp;
    next.potCp += debitCp;
    log(next, `${player.name} calls for ${formatCopper(debitCp)}.`);
  } else if (action === "raise") {
    const total = Number(amountCp);
    assert(Number.isInteger(total) && total > 0, "A raise must be a whole number of copper pieces.");
    const minimum = currentBet === 0 ? next.anteCp : currentBet + next.betting.minRaise;
    assert(total >= minimum, `The minimum legal bet is ${formatCopper(minimum)} this round.`);
    assert(total > paid, "The new bet must exceed this player’s current contribution.");
    debitCp = total - paid;
    raised = true;
    next.betting.currentBet = total;
    next.betting.minRaise = currentBet === 0 ? total : total - currentBet;
    next.betting.roundBets[playerId] = total;
    player.contributionCp += debitCp;
    next.potCp += debitCp;
    log(next, `${player.name} ${currentBet === 0 ? "opens" : "raises"} to ${formatCopper(total)}.`);
  } else if (action === "fold") {
    player.folded = true;
    log(next, `${player.name} folds.`);
  } else {
    throw new Error("Unknown betting action.");
  }

  if (activePlayers(next).length === 1) {
    resolveFoldWin(next);
    return { state: next, debitCp, debitPlayerId: debitCp ? playerId : null };
  }
  if (!refreshPendingAndTurn(next, playerId, raised)) {
    if (next.betting.stage === "final") resolveShowdown(next);
    else if (next.round >= next.seatCount) beginPlunder(next);
    else advanceReveal(next);
  }
  return { state: next, debitCp, debitPlayerId: debitCp ? playerId : null };
}

function beginPlunder(state) {
  const queue = buildPlunderQueue(state);
  if (queue.length === 0) {
    state.betting = null;
    beginBetting(state, state.dealerSeat, { final: true });
    return;
  }
  state.phase = PHASES.PLUNDER;
  state.plunder = { queue, index: 0 };
  state.pendingPlunder = null;
  state.betting = null;
  log(state, "The Pirate’s Plunder phase begins.");
}

export function plunder(state, playerId, { targetId, suit = null, rank = null } = {}) {
  const next = cloneState(state);
  assert(next.phase === PHASES.PLUNDER && next.plunder, "The Plunder phase is not active.");
  const step = next.plunder.queue[next.plunder.index];
  assert(step && step.playerId === playerId, "It is not this Pirate player’s turn.");
  const piratePlayer = playerById(next, playerId);
  const pirateIndex = piratePlayer.hand.findIndex((card) => card.id === step.cardId);
  assert(pirateIndex >= 0, "This Pirate card is no longer available.");
  assert(suit || rank, "Name a suit, a value, or both when Plundering.");
  const target = playerById(next, targetId);
  assert(target && target.id !== playerId, "Choose another player as the Plunder target.");
  const protectedIds = new Set(next.plunder.queue.map((entry) => entry.playerId));
  assert(!protectedIds.has(targetId), "A player showing a Pirate card cannot be Plundered.");
  const matches = target.hand.filter((card) => !card.pirate && (!suit || card.suit === suit) && (!rank || card.rank === rank));
  next.pendingPlunder = { fromId: playerId, targetId, pirateCardId: step.cardId, suit, rank, matches: matches.map((card) => card.id) };
  if (matches.length === 0) {
    discardPlayedPirate(next);
    log(next, `${piratePlayer.name} tries to Plunder from ${target.name}, but finds no matching card.`);
    advancePlunder(next);
  } else {
    next.phase = PHASES.TRANSFER;
    log(next, `${piratePlayer.name} tries to Plunder a ${rank ?? ""}${rank && suit ? " of " : ""}${suit ?? ""} card from ${target.name}.`);
  }
  return next;
}

export function declinePlunder(state, playerId) {
  const next = cloneState(state);
  assert(next.phase === PHASES.PLUNDER && next.plunder, "The Plunder phase is not active.");
  const step = next.plunder.queue[next.plunder.index];
  assert(step && step.playerId === playerId, "It is not this Pirate player’s turn.");
  const player = playerById(next, playerId);
  log(next, `${player.name} declines to use a Pirate card.`);
  advancePlunder(next);
  return next;
}

function discardPlayedPirate(state) {
  const pending = state.pendingPlunder;
  const player = playerById(state, pending.fromId);
  const index = player.hand.findIndex((card) => card.id === pending.pirateCardId);
  if (index >= 0) state.discard.push(...player.hand.splice(index, 1));
}

export function choosePlunderTransfer(state, playerId, cardId) {
  const next = cloneState(state);
  assert(next.phase === PHASES.TRANSFER && next.pendingPlunder, "No Plunder transfer is awaiting a choice.");
  const pending = next.pendingPlunder;
  assert(pending.targetId === playerId, "Only the Plundered player may choose the card to surrender.");
  assert(pending.matches.includes(cardId), "The selected card does not match the Pirate’s demand.");
  const target = playerById(next, pending.targetId);
  const piratePlayer = playerById(next, pending.fromId);
  const index = target.hand.findIndex((card) => card.id === cardId);
  assert(index >= 0, "The selected card is no longer in the target’s hand.");
  const [card] = target.hand.splice(index, 1);
  piratePlayer.hand.push(card);
  discardPlayedPirate(next);
  log(next, `${target.name} gives ${cardLabel(card)} to ${piratePlayer.name}.`);
  next.phase = PHASES.PLUNDER;
  advancePlunder(next);
  return next;
}

function resolveShowdown(state) {
  const scores = activePlayers(state).map((player) => ({ player, score: bestPokerHand([...player.hand, ...revealedCommons(state)]) }));
  const best = scores.reduce((current, entry) => (!current || compareScore(entry.score, current.score) > 0 ? entry : current), null);
  const winners = scores.filter((entry) => compareScore(entry.score, best.score) === 0).map((entry) => entry.player);
  returnRoundSummary(state, winners, scores);
  for (const { player, score } of scores) log(state, `${player.name} reveals ${score.name}.`);
  log(state, `${winners.map((player) => player.name).join(" and ")} ${winners.length === 1 ? "wins" : "split"} the round with ${best.score.name}.`);
  awardPot(state, winners);
}

export function disqualifyPoppyPlayer(state, playerId, reason = "Disqualified by the GM") {
  const next = cloneState(state);
  const player = playerById(next, playerId);
  assert(player, "That actor is not participating in Poppy’s Prize.");
  assert(!player.disqualified, "That participant is already disqualified.");
  player.disqualified = true;
  player.folded = true;
  next.disqualifications ??= [];
  next.disqualifications.push({ playerId, reason: String(reason), at: Date.now() });
  log(next, `${player.name} is disqualified: ${reason}.`);

  if (activePlayers(next).length === 1 && [PHASES.BETTING, PHASES.SELECT_COMMON, PHASES.PLUNDER, PHASES.TRANSFER].includes(next.phase)) {
    resolveFoldWin(next);
    return next;
  }
  if (next.phase === PHASES.SELECT_COMMON && !next.common.some((entry) => entry.playerId === playerId)) {
    const fallback = player.hand.shift();
    if (fallback) next.common.push({ seat: player.seat, playerId, name: player.name, card: fallback, revealed: false, dummy: false, disqualified: true });
    if (allCommonsSelected(next)) advanceReveal(next);
  }
  if (next.phase === PHASES.BETTING && next.betting) {
    next.betting.pending = next.betting.pending.filter((id) => id !== playerId);
    if (!next.betting.pending.length) {
      if (next.betting.stage === "final") resolveShowdown(next);
      else if (next.round >= next.seatCount) beginPlunder(next);
      else advanceReveal(next);
    } else if (next.betting.turnSeat === player.seat) {
      next.betting.turnSeat = nextActiveSeat(next, player.seat, next.betting.pending);
    }
  }
  if (next.phase === PHASES.PLUNDER && next.plunder) {
    next.plunder.queue = next.plunder.queue.filter((entry) => entry.playerId !== playerId);
    next.plunder.index = Math.min(next.plunder.index, next.plunder.queue.length);
    if (next.pendingPlunder?.targetId === playerId || next.plunder.queue[next.plunder.index]?.playerId === playerId) advancePlunder(next);
  }
  if (next.phase === PHASES.KEEP && next.keepers && Object.hasOwn(next.keepers, playerId)) {
    next.keepers[playerId] = null;
  }
  return next;
}

export function showdown(state) {
  const next = cloneState(state);
  resolveShowdown(next);
  return next;
}

export function chooseKeep(state, playerId, cardId = null) {
  const next = cloneState(state);
  assert(next.phase === PHASES.KEEP && next.keepers, "Cards cannot be kept at this time.");
  const player = playerById(next, playerId);
  assert(player, "Unknown player.");
  if (cardId) {
    const owned = player.hand.some((card) => card.id === cardId);
    const common = next.common.some((entry) => entry.card.id === cardId);
    assert(owned || (next.winners.includes(playerId) && common), "This card cannot be kept by this player.");
    assert(!player.forcedCarry.some((card) => card.id === cardId), "The awarded Pirate card is already carried automatically.");
  }
  next.keepers[playerId] = cardId;
  log(next, cardId ? `${player.name} secretly chooses a card to keep.` : `${player.name} chooses not to keep a card.`);
  if (next.players.every((entry) => next.keepers[entry.id] !== false)) next.phase = PHASES.COMPLETE;
  return next;
}

export function getCurrentActor(state) {
  if (state.phase === PHASES.BETTING && state.betting) {
    return memberBySeat(state, state.betting.turnSeat)?.id ?? null;
  }
  if (state.phase === PHASES.PLUNDER && state.plunder) return state.plunder.queue[state.plunder.index]?.playerId ?? null;
  if (state.phase === PHASES.TRANSFER && state.pendingPlunder) return state.pendingPlunder.targetId;
  return null;
}

export function publicStateSummary(state) {
  return {
    gameNumber: state.gameNumber,
    phase: state.phase,
    round: state.round,
    potCp: state.potCp,
    anteCp: state.anteCp,
    dealerSeat: state.dealerSeat,
    currentActorId: getCurrentActor(state),
  };
}

export const RULE_DATA = Object.freeze({ suits: SUITS, ranks: RANKS });
export const _test = Object.freeze({ compareScore, handScoreFromFive, chooseCombinations });
