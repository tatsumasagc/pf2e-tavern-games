import { bestPokerHand, createDeck, shuffle } from "./engine.mjs";

export const TAVERN_GAME_IDS = Object.freeze({
  GOLEM: "golem",
  BOUNDER: "bounder",
  CENTURY: "century",
  DRINKING: "drinking",
});

export const TAVERN_GAME_NAMES = Object.freeze({
  [TAVERN_GAME_IDS.GOLEM]: "Golem",
  [TAVERN_GAME_IDS.BOUNDER]: "Bounder",
  [TAVERN_GAME_IDS.CENTURY]: "Century",
  [TAVERN_GAME_IDS.DRINKING]: "Drinking Contest",
});

export const DRINKING_STAGES = Object.freeze([
  { stage: 0, name: "Clear-Headed", duration: null, conditions: [], effect: "No drinking-contest effect." },
  { stage: 1, name: "Liquid Courage", duration: "10 minutes", conditions: [], effect: "+1 item bonus to saving throws against fear effects." },
  { stage: 2, name: "Tipsy", duration: "10 minutes", conditions: [{ slug: "off-guard", value: null }], effect: "Off-guard; +1 item bonus to saving throws against fear effects." },
  { stage: 3, name: "Sloshed", duration: "10 minutes", conditions: [{ slug: "clumsy", value: 1 }, { slug: "off-guard", value: null }, { slug: "stupefied", value: 2 }], effect: "Clumsy 1, off-guard, and stupefied 2." },
  { stage: 4, name: "Wobbling", duration: "10 minutes", conditions: [{ slug: "clumsy", value: 2 }, { slug: "sickened", value: 2 }], effect: "Clumsy 2 and sickened 2." },
  { stage: 5, name: "Blackout Bound", duration: "10 minutes", conditions: [{ slug: "clumsy", value: 2 }, { slug: "sickened", value: 2 }, { slug: "stupefied", value: 2 }], effect: "Clumsy 2, sickened 2, and stupefied 2." },
  { stage: 6, name: "Passed Out", duration: "8 hours", conditions: [{ slug: "unconscious", value: null }], effect: "Unconscious for 8 hours; eliminated from the contest." },
]);

// Row is matched numbers; column is numbers selected. Values are gross payout multipliers.
export const CENTURY_PAYOUTS = Object.freeze({
  1: { 2: 1 },
  2: { 2: 5, 3: 2, 4: 2 },
  3: { 3: 30, 4: 5, 5: 2, 6: 2, 7: 1 },
  4: { 4: 60, 5: 10, 6: 4, 7: 2, 8: 2, 9: 1 },
  5: { 5: 200, 6: 50, 7: 20, 8: 10, 9: 5, 10: 5 },
  6: { 6: 800, 7: 400, 8: 100, 9: 40, 10: 20 },
  7: { 7: 2000, 8: 1500, 9: 200, 10: 100 },
  8: { 8: 5000, 9: 2000, 10: 500 },
  9: { 9: 5000, 10: 2000 },
  10: { 10: 5000 },
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function clone(value) {
  return structuredClone(value);
}

function wholeCopper(value, label = "Amount") {
  const amount = Number(value);
  assert(Number.isSafeInteger(amount) && amount >= 0, `${label} must be a non-negative whole number of copper pieces.`);
  return amount;
}

function validParticipants(participants, { minimum = 2, maximum = 20 } = {}) {
  assert(Array.isArray(participants) && participants.length >= minimum && participants.length <= maximum, `Select between ${minimum} and ${maximum} participants.`);
  const ids = participants.map((player) => player.id);
  assert(new Set(ids).size === ids.length, "Each participant must be unique.");
  return participants.map((player, index) => ({
    id: player.id,
    actorId: player.actorId ?? player.id,
    name: player.name,
    seat: index + 1,
    disqualified: false,
  }));
}

function qualifiedPlayers(state) {
  return state.players.filter((player) => !player.disqualified && !player.folded && !player.out);
}

function player(state, playerId) {
  const found = state.players.find((entry) => entry.id === playerId);
  assert(found, "That participant is not part of this table.");
  return found;
}

function qualified(state, playerId) {
  const found = player(state, playerId);
  assert(!found.disqualified && !found.folded && !found.out, "That participant is no longer eligible in this game.");
  return found;
}

function nextQualifiedSeat(state, afterSeat) {
  const active = qualifiedPlayers(state);
  if (!active.length) return null;
  for (let offset = 1; offset <= state.players.length; offset += 1) {
    const seat = ((afterSeat - 1 + offset) % state.players.length) + 1;
    if (active.some((entry) => entry.seat === seat)) return seat;
  }
  return active[0].seat;
}

function randomInteger(minimum, maximum, rng = Math.random) {
  return Math.floor(rng() * (maximum - minimum + 1)) + minimum;
}

const GOLEM_SUIT_ART = Object.freeze({
  trees: { file: "clubs", label: "Clubs", symbol: "♣" },
  ships: { file: "spades", label: "Spades", symbol: "♠" },
  gems: { file: "diamonds", label: "Diamonds", symbol: "♦" },
  parrots: { file: "hearts", label: "Hearts", symbol: "♥" },
});

function golemRankFile(rank) {
  if (rank === "A") return "ace";
  if (rank === "J") return "jack";
  if (rank === "Q") return "queen";
  if (rank === "K") return "king";
  return String(rank).padStart(2, "0");
}

function cardDeckForGolem() {
  return createDeck().filter((card) => !card.pirate).map((card) => {
    const art = GOLEM_SUIT_ART[card.suit];
    const rankLabel = card.rank === "A" ? "Ace" : card.rank === "J" ? "Jack" : card.rank === "Q" ? "Queen" : card.rank === "K" ? "King" : card.rank;
    return {
      ...card,
      rank: card.rank === "A" ? "1" : card.rank,
      image: `assets/golem-cards/${art.file}-${golemRankFile(card.rank)}.webp`,
      displayLabel: `${rankLabel} of ${art.label}`,
      displayCompact: `${card.rank === "A" ? "A" : card.rank}${art.symbol}`,
    };
  });
}

function golemScore(cards) {
  // The Poppy engine scores Ace high. Golem has cards numbered 1–13; mapping 1 back to A
  // preserves the familiar poker evaluator while keeping the public Golem labels numeric.
  const mapped = cards.map((card) => ({ ...card, rank: card.rank === "1" ? "A" : card.rank, value: card.rank === "1" ? 14 : card.value }));
  return bestPokerHand(mapped);
}

function scoreCompare(left, right) {
  if (left.category !== right.category) return left.category - right.category;
  for (let index = 0; index < Math.max(left.tiebreak.length, right.tiebreak.length); index += 1) {
    const difference = (left.tiebreak[index] ?? 0) - (right.tiebreak[index] ?? 0);
    if (difference) return difference;
  }
  return 0;
}

function initializeGolemBetting(state, round) {
  const active = qualifiedPlayers(state);
  state.phase = `golem-betting-${round}`;
  state.betting = {
    round,
    currentBet: 0,
    minimumRaise: state.anteCp,
    roundBets: Object.fromEntries(active.map((entry) => [entry.id, 0])),
    pending: active.map((entry) => entry.id),
    turnSeat: state.amuletSeat,
  };
}

function advanceGolemBetting(state, actedId, raised) {
  const active = qualifiedPlayers(state);
  const betting = state.betting;
  betting.pending = raised ? active.filter((entry) => entry.id !== actedId).map((entry) => entry.id) : betting.pending.filter((id) => id !== actedId);
  if (!betting.pending.length) {
    state.betting = null;
    if (state.phase === "golem-betting-1") {
      state.phase = "golem-discard";
      state.discardChoices = Object.fromEntries(active.map((entry) => [entry.id, null]));
    } else {
      state.phase = "golem-showdown";
    }
    return;
  }
  const acted = player(state, actedId);
  const pendingSeats = active.filter((entry) => betting.pending.includes(entry.id)).map((entry) => entry.seat);
  betting.turnSeat = nextQualifiedSeat({ ...state, players: state.players.map((entry) => ({ ...entry, folded: entry.folded || !pendingSeats.includes(entry.seat) })) }, acted.seat) ?? active.find((entry) => betting.pending.includes(entry.id))?.seat ?? active[0].seat;
}

export function createGolemGame({ participants, dealerId, anteCp = 5, markedCardSight = false, rng = Math.random } = {}) {
  const players = validParticipants(participants, { minimum: 3, maximum: 6 }).map((entry) => ({ ...entry, hand: [], folded: false, contributionCp: 0 }));
  assert(players.some((entry) => entry.id === dealerId), "Choose a participating deck owner as Golem’s dealer.");
  const dealer = players.find((entry) => entry.id === dealerId);
  const amuletSeat = nextQualifiedSeat({ players }, dealer.seat) ?? players[0].seat;
  return {
    version: 1,
    game: TAVERN_GAME_IDS.GOLEM,
    gameNumber: 1,
    phase: "golem-deal",
    players,
    dealerId,
    dealerSeat: dealer.seat,
    amuletSeat,
    anteCp: wholeCopper(anteCp, "Ante"),
    potCp: 0,
    deck: shuffle(cardDeckForGolem(), rng),
    discards: [],
    betting: null,
    discardChoices: null,
    markedCardSight: Boolean(markedCardSight),
    cheatingDealerId: markedCardSight ? dealerId : null,
    log: [`Golem table prepared. ${dealer.name} is dealer; seat ${amuletSeat} holds the amulet.`],
  };
}

export function dealGolem(state, { markedCardIds = [], dealerHandCardIds = [] } = {}) {
  assert(state?.game === TAVERN_GAME_IDS.GOLEM && state.phase === "golem-deal", "Golem is not ready to deal.");
  const next = clone(state);
  const dealer = player(next, next.dealerId);
  const markedChoices = [...new Set(markedCardIds.filter(Boolean))];
  const handChoices = [...new Set(dealerHandCardIds.filter(Boolean))];
  assert(!markedChoices.length || !handChoices.length, "Use either marked-card selection or a social cheating hand selection, not both.");
  assert(markedChoices.length === 0 || (next.gameNumber === 1 && markedChoices.length === 2), "Marked-card selection requires exactly two cards and is available only for Golem’s first hand.");
  assert(handChoices.length === 0 || handChoices.length === Math.max(0, 5 - dealer.hand.length), "A cheating Dealer must choose every card needed to complete their hand.");
  const selected = handChoices.length ? handChoices : markedChoices;
  const chosen = selected.map((id) => next.deck.find((card) => card.id === id));
  assert(chosen.every(Boolean), "Choose cards that remain in the deck.");
  if (chosen.length) {
    next.deck = next.deck.filter((card) => !selected.includes(card.id));
    dealer.hand.push(...chosen);
    if (markedChoices.length) next.cheatingDealerId = dealer.id;
  }
  for (const entry of next.players) {
    while (entry.hand.length < 5) entry.hand.push(next.deck.shift());
    entry.contributionCp += next.anteCp;
    next.potCp += next.anteCp;
  }
  initializeGolemBetting(next, 1);
  next.log.push("The dealer dealt five cards to each player and collected antes.");
  return next;
}

export function golemBet(state, playerId, action, totalCp = null) {
  assert(state?.game === TAVERN_GAME_IDS.GOLEM && ["golem-betting-1", "golem-betting-2"].includes(state.phase), "Golem is not in a betting round.");
  const next = clone(state);
  const gambler = qualified(next, playerId);
  assert(next.betting.turnSeat === gambler.seat, "It is not that participant’s betting turn.");
  const alreadyPaid = next.betting.roundBets[gambler.id] ?? 0;
  const current = next.betting.currentBet;
  let additional = 0;
  let raised = false;
  if (action === "fold") {
    gambler.folded = true;
  } else if (action === "match") {
    assert(current > 0, "There is no current bet to match.");
    additional = current - alreadyPaid;
    next.betting.roundBets[gambler.id] = current;
  } else if (action === "pass") {
    assert(current === 0, "A participant may pass only before a bet has been opened.");
  } else if (action === "bet" || action === "raise") {
    const total = wholeCopper(totalCp, "Bet total");
    const minimum = current === 0 ? next.anteCp : current + next.betting.minimumRaise;
    assert(total >= minimum, `The bet total must be at least ${minimum} cp.`);
    additional = total - alreadyPaid;
    assert(additional > 0, "The new total must exceed this participant’s current bet.");
    next.betting.roundBets[gambler.id] = total;
    next.betting.minimumRaise = current === 0 ? next.anteCp : total - current;
    next.betting.currentBet = total;
    raised = true;
  } else {
    throw new Error("Choose bet, match, raise, or fold.");
  }
  gambler.contributionCp += additional;
  next.potCp += additional;
  advanceGolemBetting(next, gambler.id, raised);
  if (qualifiedPlayers(next).length === 1) next.phase = "golem-showdown";
  next.log.push(`${gambler.name} ${action}${additional ? ` (${additional} cp)` : ""}.`);
  return { state: next, debitPlayerId: gambler.id, debitCp: additional };
}

export function golemDiscard(state, playerId, cardIds = []) {
  assert(state?.game === TAVERN_GAME_IDS.GOLEM && state.phase === "golem-discard", "Golem is not in the draw phase.");
  const next = clone(state);
  const gambler = qualified(next, playerId);
  assert(next.discardChoices[gambler.id] === null, "That participant has already completed their draw.");
  const unique = [...new Set(cardIds)];
  assert(unique.length <= 2, "A Golem player may discard up to two cards.");
  const discarded = unique.map((id) => gambler.hand.find((card) => card.id === id));
  assert(discarded.every(Boolean), "A player may discard only cards in their own hand.");
  gambler.hand = gambler.hand.filter((card) => !unique.includes(card.id));
  next.discards.push(...discarded);
  while (gambler.hand.length < 5) gambler.hand.push(next.deck.shift());
  next.discardChoices[gambler.id] = unique;
  if (Object.values(next.discardChoices).every((choice) => choice !== null)) initializeGolemBetting(next, 2);
  next.log.push(`${gambler.name} completed their draw.`);
  return next;
}

export function resolveGolem(state) {
  assert(state?.game === TAVERN_GAME_IDS.GOLEM && state.phase === "golem-showdown", "Golem is not ready for showdown.");
  const next = clone(state);
  const active = qualifiedPlayers(next);
  assert(active.length, "No qualified players remain in Golem.");
  const houseShare = Math.floor(next.potCp * 0.05);
  if (active.length === 1) {
    const winner = active[0];
    const payoutCp = next.potCp - houseShare;
    next.phase = "golem-complete";
    next.result = { winnerId: winner.id, payoutCp, houseShare, reason: "All other players folded.", winnerScore: null, golemScore: null };
    next.log.push(`${winner.name} wins after all other players folded.`);
    return next;
  }
  assert(next.discards.length >= 5, "Golem needs at least five discarded cards to form the golem hand. Have the GM resolve an exceptional draw manually.");
  const scored = active.map((entry) => ({ player: entry, score: golemScore(entry.hand) }));
  scored.sort((left, right) => scoreCompare(right.score, left.score));
  const winner = scored[0];
  const golem = golemScore(next.discards);
  const beatsGolem = scoreCompare(winner.score, golem) > 0;
  if (beatsGolem) {
    const payoutCp = next.potCp - houseShare;
    next.phase = "golem-complete";
    next.result = { winnerId: winner.player.id, payoutCp, houseShare, reason: `${winner.score.name} beats the golem’s ${golem.name}.`, winnerScore: winner.score, golemScore: golem };
    next.log.push(`${winner.player.name} wins Golem with ${winner.score.name}.`);
    return next;
  }
  const penalty = next.anteCp * 2;
  winner.player.contributionCp += penalty;
  next.potCp += penalty;
  next.result = { winnerId: winner.player.id, payoutCp: 0, houseShare: 0, reason: `${winner.score.name} did not beat the golem’s ${golem.name}; the pot carries forward.`, winnerScore: winner.score, golemScore: golem, penaltyCp: penalty };
  next.gameNumber += 1;
  next.amuletSeat = nextQualifiedSeat(next, next.amuletSeat) ?? next.amuletSeat;
  for (const entry of next.players) entry.hand = [];
  next.deck = shuffle(cardDeckForGolem());
  next.discards = [];
  next.phase = "golem-deal";
  next.betting = null;
  next.discardChoices = null;
  next.cheatingDealerId = null;
  next.log.push(`${winner.player.name} adds twice the ante; the pot carries into Golem hand ${next.gameNumber}.`);
  return next;
}

export function nextGolemHand(state, rng = Math.random) {
  assert(state?.game === TAVERN_GAME_IDS.GOLEM && state.phase === "golem-complete", "Complete the current Golem hand before preparing another.");
  const next = clone(state);
  next.gameNumber += 1;
  next.amuletSeat = nextQualifiedSeat(next, next.amuletSeat) ?? next.amuletSeat;
  for (const entry of next.players) {
    entry.hand = [];
    entry.folded = false;
    entry.contributionCp = 0;
  }
  next.potCp = 0;
  next.deck = shuffle(cardDeckForGolem(), rng);
  next.discards = [];
  next.betting = null;
  next.discardChoices = null;
  next.result = null;
  next.phase = "golem-deal";
  next.cheatingDealerId = null;
  next.log.push(`Golem hand ${next.gameNumber} prepared. The amulet moves counterclockwise.`);
  return next;
}

export function createBounderGame({ participants, shooterId = null, stakeCp = 5 } = {}) {
  const players = validParticipants(participants, { minimum: 2, maximum: 20 }).map((entry) => ({ ...entry, folded: false }));
  const shooter = shooterId ? players.find((entry) => entry.id === shooterId) : players[0];
  assert(shooter, "Choose a Bounder shooter from the participants.");
  return {
    version: 1,
    game: TAVERN_GAME_IDS.BOUNDER,
    gameNumber: 1,
    phase: "bounder-first-roll",
    players,
    shooterId: shooter.id,
    shooterSeat: shooter.seat,
    shooterStakeCp: wholeCopper(stakeCp, "Shooter stake"),
    point: null,
    shooterRolls: [],
    dealerDice: null,
    bets: [],
    result: null,
    log: [`Bounder is ready. ${shooter.name} is the shooter.`],
  };
}

export function bounderFirstRoll(state, result) {
  assert(state?.game === TAVERN_GAME_IDS.BOUNDER && state.phase === "bounder-first-roll", "Bounder is not waiting for the shooter’s first roll.");
  const next = clone(state);
  const roll = Number(result);
  assert(Number.isInteger(roll) && roll >= 1 && roll <= 20, "A Bounder shooter roll must be between 1 and 20.");
  next.shooterRolls = [roll];
  next.point = roll;
  next.phase = "bounder-bets";
  next.log.push(`${player(next, next.shooterId).name} established point ${roll}.`);
  return next;
}

export function bounderPlaceBet(state, { playerId, kind, amountCp }) {
  assert(state?.game === TAVERN_GAME_IDS.BOUNDER && state.phase === "bounder-bets", "Bounder bets are no longer open.");
  const next = clone(state);
  qualified(next, playerId);
  assert(["point", "even", "odd", "triple"].includes(kind), "Choose a valid Bounder bet type.");
  const amount = wholeCopper(amountCp, "Bounder bet");
  assert(amount > 0, "A Bounder bet must be greater than zero.");
  if (kind === "point") assert(playerId !== next.shooterId, "The shooter stake is already recorded separately.");
  next.bets.push({ playerId, kind, amountCp: amount });
  return next;
}

export function bounderDoubleStake(state) {
  assert(state?.game === TAVERN_GAME_IDS.BOUNDER && state.phase === "bounder-bets", "The shooter may double only before the dealer rolls.");
  const next = clone(state);
  assert(!next.shooterDoubled, "The shooter has already doubled their stake.");
  next.shooterStakeCp *= 2;
  next.shooterDoubled = true;
  next.log.push("The shooter doubled their stake.");
  return next;
}

export function bounderDealerRoll(state, dice = null, rng = Math.random) {
  assert(state?.game === TAVERN_GAME_IDS.BOUNDER && state.phase === "bounder-bets", "Bounder is not ready for the dealer roll.");
  const next = clone(state);
  const results = dice ?? [randomInteger(1, 6, rng), randomInteger(1, 6, rng), randomInteger(1, 6, rng)];
  assert(Array.isArray(results) && results.length === 3 && results.every((die) => Number.isInteger(die) && die >= 1 && die <= 6), "Bounder dealer dice must be three d6 results.");
  next.dealerDice = results;
  next.dealerTotal = results.reduce((total, die) => total + die, 0);
  next.phase = next.dealerTotal === next.point ? "bounder-complete" : "bounder-second-roll";
  if (next.phase === "bounder-complete") next.result = resolveBounderPayouts(next, null);
  next.log.push(`Dealer rolled ${results.join(", ")} (${next.dealerTotal}).`);
  return next;
}

function resolveBounderPayouts(state, shooterSecondRoll) {
  const dealer = state.dealerDice;
  const allEven = dealer.every((die) => die % 2 === 0);
  const allOdd = dealer.every((die) => die % 2 === 1);
  const triple = new Set(dealer).size === 1;
  const pointMatched = state.dealerTotal === state.point;
  const bounded = !pointMatched && shooterSecondRoll !== null && ((state.shooterRolls[0] < state.dealerTotal && shooterSecondRoll > state.dealerTotal) || (state.shooterRolls[0] > state.dealerTotal && shooterSecondRoll < state.dealerTotal));
  const perfectBound = bounded && state.shooterRolls.includes(1) && shooterSecondRoll === 20 || bounded && state.shooterRolls.includes(20) && shooterSecondRoll === 1;
  const payouts = [];
  if (bounded) payouts.push({ playerId: state.shooterId, amountCp: state.shooterStakeCp * (perfectBound ? 3 : 2), reason: perfectBound ? "Bounded the dealer with 1 and 20 (double stake profit)." : "Bounded the dealer." });
  for (const bet of state.bets) {
    if (bet.kind === "point" && bounded) payouts.push({ playerId: bet.playerId, amountCp: bet.amountCp * 2, reason: "Bet on the shooter’s bound." });
    if (bet.kind === "even" && allEven) payouts.push({ playerId: bet.playerId, amountCp: bet.amountCp * 2, reason: "Dealer rolled all even." });
    if (bet.kind === "odd" && allOdd) payouts.push({ playerId: bet.playerId, amountCp: bet.amountCp * 2, reason: "Dealer rolled all odd." });
    if (bet.kind === "triple" && triple) payouts.push({ playerId: bet.playerId, amountCp: bet.amountCp * 4, reason: "Dealer rolled three of a kind." });
  }
  return { bounded, perfectBound, pointMatched, payouts, dealerTotal: state.dealerTotal, shooterRolls: [...state.shooterRolls, ...(shooterSecondRoll === null ? [] : [shooterSecondRoll])] };
}

export function bounderSecondRoll(state, result) {
  assert(state?.game === TAVERN_GAME_IDS.BOUNDER && state.phase === "bounder-second-roll", "Bounder is not waiting for the shooter’s second roll.");
  const next = clone(state);
  const roll = Number(result);
  assert(Number.isInteger(roll) && roll >= 1 && roll <= 20, "A Bounder shooter roll must be between 1 and 20.");
  next.shooterRolls.push(roll);
  next.result = resolveBounderPayouts(next, roll);
  next.phase = "bounder-complete";
  next.log.push(`${player(next, next.shooterId).name} rolled ${roll} and ${next.result.bounded ? "bounded" : "did not bound"} the dealer.`);
  return next;
}

export function nextBounderGame(state) {
  assert(state?.game === TAVERN_GAME_IDS.BOUNDER && state.phase === "bounder-complete", "Finish the current Bounder game first.");
  const next = clone(state);
  const seat = nextQualifiedSeat(next, next.shooterSeat);
  const shooter = qualifiedPlayers(next).find((entry) => entry.seat === seat);
  assert(shooter, "There is no qualified next shooter.");
  next.gameNumber += 1;
  next.phase = "bounder-first-roll";
  next.shooterId = shooter.id;
  next.shooterSeat = shooter.seat;
  next.point = null;
  next.shooterRolls = [];
  next.dealerDice = null;
  next.dealerTotal = null;
  next.bets = [];
  next.result = null;
  next.shooterDoubled = false;
  next.log.push(`${shooter.name} becomes the next shooter.`);
  return next;
}

export function createCenturyGame({ participants, dealerId, minimumStakeCp = 5 } = {}) {
  const players = validParticipants(participants, { minimum: 2, maximum: 20 }).map((entry) => ({ ...entry, predictions: [], stakeCp: wholeCopper(minimumStakeCp, "Minimum stake") }));
  assert(players.some((entry) => entry.id === dealerId), "Choose a participating Century dealer.");
  return { version: 1, game: TAVERN_GAME_IDS.CENTURY, gameNumber: 1, phase: "century-select", players, dealerId, minimumStakeCp: wholeCopper(minimumStakeCp, "Minimum stake"), drawn: [], result: null, log: ["Century is waiting for number selections."] };
}

export function centuryChooseNumbers(state, playerId, numbers, stakeCp) {
  assert(state?.game === TAVERN_GAME_IDS.CENTURY && state.phase === "century-select", "Century selections are closed.");
  const next = clone(state);
  const gambler = qualified(next, playerId);
  const choices = [...new Set((numbers ?? []).map(Number))].sort((left, right) => left - right);
  assert(choices.length >= 2 && choices.length <= 10, "Choose between two and ten distinct Century numbers.");
  assert(choices.every((number) => Number.isInteger(number) && number >= 1 && number <= 100), "Century numbers must be whole numbers between 1 and 100.");
  const stake = wholeCopper(stakeCp, "Century stake");
  assert(stake >= next.minimumStakeCp, `Century stake must be at least ${next.minimumStakeCp} cp.`);
  gambler.predictions = choices;
  gambler.stakeCp = stake;
  if (qualifiedPlayers(next).every((entry) => entry.predictions.length >= 2)) next.phase = "century-draw";
  return next;
}

export function centuryDraw(state, numbers = null, rng = Math.random) {
  assert(state?.game === TAVERN_GAME_IDS.CENTURY && state.phase === "century-draw", "Century is not ready for the dealer draw.");
  const next = clone(state);
  let drawn = numbers ? [...new Set(numbers.map(Number))] : [];
  if (numbers) assert(drawn.length === 20 && drawn.every((number) => Number.isInteger(number) && number >= 1 && number <= 100), "Century needs twenty distinct numbers from 1 to 100.");
  while (drawn.length < 20) {
    const number = randomInteger(1, 100, rng);
    if (!drawn.includes(number)) drawn.push(number);
  }
  next.drawn = drawn.sort((left, right) => left - right);
  next.result = qualifiedPlayers(next).map((gambler) => {
    const matches = gambler.predictions.filter((number) => next.drawn.includes(number)).length;
    const multiplier = CENTURY_PAYOUTS[matches]?.[gambler.predictions.length] ?? 0;
    return { playerId: gambler.id, matches, selected: gambler.predictions.length, multiplier, payoutCp: gambler.stakeCp * multiplier };
  });
  next.phase = "century-complete";
  next.log.push(`Century dealer generated ${next.drawn.join(", ")}.`);
  return next;
}

export function createDrinkingGame({ participants, fortitudeDC = 15 } = {}) {
  const players = validParticipants(participants, { minimum: 2, maximum: 20 }).map((entry) => ({ ...entry, stage: 0, ready: false, out: false, drinkingEffectIds: [], result: null }));
  const dc = Number(fortitudeDC);
  assert(Number.isInteger(dc) && dc >= 0, "Fortitude DC must be a non-negative whole number.");
  return { version: 1, game: TAVERN_GAME_IDS.DRINKING, gameNumber: 1, round: 1, phase: "drinking-ready", players, fortitudeDC: dc, result: null, log: ["The drinking contest is waiting for every participant to be ready."] };
}

export function setDrinkingReady(state, playerId, ready = true) {
  assert(state?.game === TAVERN_GAME_IDS.DRINKING && state.phase === "drinking-ready", "The drinking contest is not waiting for readiness.");
  const next = clone(state);
  const contestant = qualified(next, playerId);
  contestant.ready = Boolean(ready);
  if (qualifiedPlayers(next).every((entry) => entry.ready)) next.phase = "drinking-resolve";
  return next;
}

export function drinkStage(stage) {
  return DRINKING_STAGES[Math.max(0, Math.min(6, Number(stage) || 0))];
}

export function drinkingAdjustment(degree) {
  if (degree === "criticalSuccess") return -1;
  if (degree === "success") return 0;
  if (degree === "failure") return 1;
  if (degree === "criticalFailure") return 2;
  throw new Error("A drinking Fortitude result must be criticalSuccess, success, failure, or criticalFailure.");
}

export function resolveDrinkingRound(state, resolutions) {
  assert(state?.game === TAVERN_GAME_IDS.DRINKING && state.phase === "drinking-resolve", "The drinking contest is not ready to resolve.");
  const next = clone(state);
  assert(Array.isArray(resolutions), "Supply a result for each ready participant.");
  const resultByPlayer = new Map(resolutions.map((entry) => [entry.playerId, entry]));
  for (const contestant of qualifiedPlayers(next)) {
    const result = resultByPlayer.get(contestant.id);
    assert(result, `Missing drinking result for ${contestant.name}.`);
    const degree = result.cheated ? "success" : result.fortitudeDegree;
    const adjustment = drinkingAdjustment(degree);
    contestant.stage = Math.max(0, Math.min(6, contestant.stage + adjustment));
    contestant.out = contestant.stage >= 6;
    contestant.ready = false;
    contestant.result = { performanceTotal: result.performanceTotal ?? null, fortitudeTotal: result.fortitudeTotal ?? null, fortitudeDegree: degree, cheated: result.cheated === true, stage: contestant.stage };
  }
  next.result = qualifiedPlayers(next).map((entry) => ({ playerId: entry.id, stage: entry.stage, stageName: drinkStage(entry.stage).name, out: entry.out }));
  const remaining = qualifiedPlayers(next);
  next.phase = remaining.length <= 1 ? "drinking-complete" : "drinking-ready";
  if (next.phase === "drinking-ready") next.round += 1;
  next.log.push(`Drinking round ${state.round} resolved.`);
  return next;
}

export function disqualifyTavernPlayer(state, playerId, reason = "Disqualified by the GM") {
  const next = clone(state);
  const entrant = player(next, playerId);
  assert(!entrant.disqualified, "That participant is already disqualified.");
  entrant.disqualified = true;
  entrant.folded = true;
  entrant.out = true;
  entrant.ready = false;
  next.disqualifications ??= [];
  next.disqualifications.push({ playerId, reason: String(reason || "Disqualified by the GM"), at: Date.now() });
  if (next.game === TAVERN_GAME_IDS.DRINKING && next.phase === "drinking-ready" && qualifiedPlayers(next).length && qualifiedPlayers(next).every((entry) => entry.ready)) next.phase = "drinking-resolve";
  next.log.push(`${entrant.name} was disqualified: ${reason}.`);
  return next;
}

export function loadedDiceEligible(actor) {
  return Boolean(actor?.items?.some((item) => item.slug === "games-loaded-dice" || item.system?.slug === "games-loaded-dice"));
}

export function markedCardsEligible(actor) {
  return Boolean(actor?.items?.some((item) => item.slug === "marked-playing-cards" || item.system?.slug === "marked-playing-cards"));
}

export function gameSummary(state) {
  if (!state) return null;
  return {
    game: state.game,
    name: TAVERN_GAME_NAMES[state.game],
    gameNumber: state.gameNumber,
    phase: state.phase,
    players: state.players.map((entry) => ({ id: entry.id, actorId: entry.actorId, name: entry.name, seat: entry.seat, disqualified: entry.disqualified === true, folded: entry.folded === true, out: entry.out === true, stage: entry.stage ?? null })),
    log: state.log?.slice(-8) ?? [],
  };
}
