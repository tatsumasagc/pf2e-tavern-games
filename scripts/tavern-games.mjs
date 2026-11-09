import {
  TAVERN_GAME_IDS,
  TAVERN_GAME_NAMES,
  DRINKING_STAGES,
  CENTURY_PAYOUTS,
  createGolemGame,
  dealGolem,
  golemBet,
  golemDiscard,
  resolveGolem,
  nextGolemHand,
  createBounderGame,
  bounderFirstRoll,
  bounderPlaceBet,
  bounderDoubleStake,
  bounderDealerRoll,
  bounderSecondRoll,
  nextBounderGame,
  createCenturyGame,
  centuryChooseNumbers,
  centuryDraw,
  createDrinkingGame,
  setDrinkingReady,
  resolveDrinkingRound,
  createArmWrestlingGame,
  setArmWrestlingReady,
  resolveArmWrestlingRound,
  createSlappingGame,
  resolveSlappingRound,
  disqualifyTavernPlayer,
  drinkStage,
  loadedDiceEligible,
  markedCardsEligible,
  gameSummary,
} from "./tavern-games-engine.mjs";
import { cardLabel, compactCardLabel, copperToCoins, coinsToCopper, formatCopper, sortCardsForSelection } from "./engine.mjs";
import { findSceneControl } from "./scene-controls.mjs";

const MODULE_ID = "pf2e-tavern-games";
const LEGACY_MODULE_ID = "poppys-prize";
const STATE_KEY = "tavernGameState";
const BOARD_KEY = "tavernGameBoard";
const VIEW_FLAG = "tavernGameView";
const REQUEST_FLAG = "tavernGameRequest";
const STATUS_FLAG = "tavernGameStatus";
const DRINKING_EFFECT_FLAG = "drinkingStageEffects";
const GAME_SOURCE_URL = "https://2e.aonprd.com/Rules.aspx?ID=1452";
let gameApp = null;
let playerApp = null;
let queue = Promise.resolve();

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" })[character]);
}

function isGM() {
  return game.user?.isGM === true;
}

function isPrimaryGM() {
  return isGM() && game.users.activeGM?.id === game.user.id;
}

function actor(id) {
  return id ? game.actors.get(id) ?? null : null;
}

function competitiveGame(current) {
  return [TAVERN_GAME_IDS.ARM_WRESTLING, TAVERN_GAME_IDS.SLAPPING, TAVERN_GAME_IDS.DRINKING].includes(current?.game);
}
function actorLevel(entryActor) {
  return Number(entryActor?.system?.details?.level?.value ?? entryActor?.level ?? 0);
}
function statisticModifier(entryActor, statistic) {
  const value = statistic === "fortitude" ? entryActor?.saves?.fortitude?.modifier : entryActor?.skills?.athletics?.mod ?? entryActor?.skills?.athletics?.modifier ?? entryActor?.system?.skills?.athletics?.value;
  return Number(value ?? 0);
}
function competitiveRating(entryActor, game) {
  const athletics = statisticModifier(entryActor, "athletics");
  const fortitude = statisticModifier(entryActor, "fortitude");
  return actorLevel(entryActor) * 2 + (game === TAVERN_GAME_IDS.SLAPPING ? athletics + fortitude : game === TAVERN_GAME_IDS.DRINKING ? fortitude : athletics);
}
function suggestedCompetitivePrize(current) {
  const levels = current.players.map((entry) => actorLevel(actor(entry.actorId)));
  const averageLevel = levels.reduce((sum, value) => sum + value, 0) / Math.max(1, levels.length);
  const relevantStats = current.players.map((entry) => {
    const entryActor = actor(entry.actorId);
    const athletics = statisticModifier(entryActor, "athletics");
    const fortitude = statisticModifier(entryActor, "fortitude");
    return current.game === TAVERN_GAME_IDS.SLAPPING ? (athletics + fortitude) / 2 : current.game === TAVERN_GAME_IDS.DRINKING ? fortitude : athletics;
  });
  const averageRelevantStat = relevantStats.reduce((sum, value) => sum + value, 0) / Math.max(1, relevantStats.length);
  // Silver is the everyday unit: 1 sp for unskilled daily work, 5 sp for skilled work.
  // Each level adds 5 sp of reputation, while positive relevant skill adds a modest premium.
  const purseSp = 1 + Math.round(averageLevel * 5) + Math.max(0, Math.round(averageRelevantStat));
  const boutMultiplier = current.game === TAVERN_GAME_IDS.SLAPPING && current.boutType === "title" ? 2 : 1;
  return Math.max(10, Math.max(purseSp + 1, Math.round(purseSp * 3.5)) * boutMultiplier * 10);
}
function competitiveOdds(current, modifiers = current.betting?.oddsModifiers ?? {}) {
  const ratings = current.players.map((entry) => ({ entry, rating: competitiveRating(actor(entry.actorId), current.game) + Number(modifiers[entry.id] ?? 0) * 2 }));
  return Object.fromEntries(ratings.map(({ entry, rating }) => {
    const opponent = ratings.find((other) => other.entry.id !== entry.id)?.rating ?? rating;
    const value = Math.max(1.1, Math.min(5, 1.5 + (opponent - rating) * 0.1));
    return [entry.id, Math.round(value * 100) / 100];
  }));
}
function initCompetitiveBetting(current, { prizeCp = null, autoCurrency = false } = {}) {
  const suggestedPrizeCp = suggestedCompetitivePrize(current);
  return { odds: competitiveOdds(current, {}), oddsModifiers: {}, locked: false, bets: [], settled: false, prizeCp: Number.isInteger(prizeCp) && prizeCp > 0 ? prizeCp : suggestedPrizeCp, suggestedPrizeCp, autoCurrency: autoCurrency === true, payouts: [], prizePaid: false };
}
function spectatorActorForCurrent() {
  const target = playerApp?.spectator && playerApp.actorId ? actor(playerApp.actorId) : null;
  return target?.isOwner ? target : null;
}
function competitiveSpectatorView(current, entryActor) {
  if (!current || !competitiveGame(current) || !entryActor) return null;
  const board = current?.players && current?.betting ? (current.betting.odds ? publicGameBoard(current) : current) : current;
  return { version: 1, spectator: true, actorId: entryActor.id, board, player: { id: entryActor.id, name: entryActor.name, level: actorLevel(entryActor), athletics: statisticModifier(entryActor, "athletics"), fortitude: statisticModifier(entryActor, "fortitude") }, choices: { canBet: current.phase !== `${current.game}-complete` } };
}
function formatOdds(value) { return `${Number(value ?? 0).toFixed(2)}×`; }

function state() {
  return game.settings.get(MODULE_ID, STATE_KEY);
}

function gameActorGroups() {
  const eligible = game.actors.filter((entry) => ["character", "npc"].includes(entry.type));
  const partyMemberIds = new Set((game.actors.party?.members ?? []).map((member) => member.id));
  const sortByName = (entries) => entries.sort((left, right) => left.name.localeCompare(right.name, game.i18n.lang));
  return {
    partyMembers: sortByName(eligible.filter((entry) => partyMemberIds.has(entry.id))),
    otherActors: sortByName(eligible.filter((entry) => !partyMemberIds.has(entry.id))),
  };
}

function gameActorList() {
  const { partyMembers, otherActors } = gameActorGroups();
  return [...partyMembers, ...otherActors];
}

function controlledTokenActorIds() {
  return [...new Set((canvas?.tokens?.controlled ?? []).map((token) => token.actor?.id).filter((id) => id && actor(id)))];
}
function participantOptions({ includeDummy = true, selectedId = null } = {}) {
  const { partyMembers, otherActors } = gameActorGroups();
  const buildOptions = (entries) => entries.map((entry) => `<option value="${escapeHTML(entry.id)}" ${entry.id === selectedId ? "selected" : ""}>${escapeHTML(entry.name)}</option>`).join("");
  return `${includeDummy ? `<option value="" ${selectedId ? "" : "selected"}>- Dummy</option>` : `<option value="" ${selectedId ? "" : "selected"}>- Choose a participant -</option>`}${partyMembers.length ? `<optgroup label="Party Members">${buildOptions(partyMembers)}</optgroup>` : ""}${otherActors.length ? `<optgroup label="Other Actors">${buildOptions(otherActors)}</optgroup>` : ""}`;
}

function updateQueue(work) {
  queue = queue.then(work, work).catch((error) => {
    console.error(`${MODULE_ID} | Tavern game action failed`, error);
    ui.notifications.error(error.message ?? "Tavern game action failed.");
    throw error;
  });
  return queue;
}

function playerById(current, playerId) {
  return current?.players?.find((entry) => entry.id === playerId) ?? null;
}

function playerForActor(current, actorId) {
  return current?.players?.find((entry) => entry.actorId === actorId) ?? null;
}

function qualified(current, player) {
  return player && !player.disqualified && !player.folded && !player.out;
}

function activeOwnerIds(entryActor) {
  return game.users.filter((user) => user.active && !user.isGM && entryActor?.testUserPermission(user, "OWNER")).map((user) => user.id);
}

function currentPlayerActor() {
  const spectator = spectatorActorForCurrent();
  if (spectator) return spectator;
  const shown = playerApp?.actorId ? actor(playerApp.actorId) : null;
  if (shown?.isOwner && shown.getFlag(MODULE_ID, VIEW_FLAG)) return shown;
  const defaultActor = game.user?.character;
  if (defaultActor?.isOwner && defaultActor.getFlag(MODULE_ID, VIEW_FLAG)) return defaultActor;
  return game.actors.find((entry) => entry.isOwner && entry.getFlag(MODULE_ID, VIEW_FLAG)) ?? null;
}

function hasMarkedCards(entryActor) {
  return markedCardsEligible(entryActor);
}

function hasLoadedDice(entryActor) {
  return loadedDiceEligible(entryActor);
}

function phaseTitle(current) {
  const names = {
    "golem-deal": "Golem — Deal cards",
    "golem-betting-1": "Golem — First betting round",
    "golem-discard": "Golem — Draw cards",
    "golem-betting-2": "Golem — Second betting round",
    "golem-showdown": "Golem — Free the golem",
    "golem-complete": "Golem — Hand complete",
    "bounder-first-roll": "Bounder — Establish the point",
    "bounder-bets": "Bounder — Place bets",
    "bounder-second-roll": "Bounder — Bound the dealer",
    "bounder-complete": "Bounder — Round complete",
    "century-select": "Century — Choose numbers",
    "century-draw": "Century — Dealer draw",
    "century-complete": "Century — Round complete",
    "drinking-ready": "Drinking Contest — Ready the round",
    "drinking-resolve": "Drinking Contest — Resolve drinks",
    "drinking-complete": "Drinking Contest — Complete",
    "arm-wrestling-ready": "Arm Wrestling — Ready for the round",
    "arm-wrestling-resolve": "Arm Wrestling — Resolve the struggle",
    "arm-wrestling-complete": "Arm Wrestling — Match complete",
    "slapping-round": "Slapping — Round in progress",
    "slapping-complete": "Slapping — Bout complete",
  };
  return names[current?.phase] ?? "Tavern Game";
}

function phaseInstructions(current, playerId = null) {
  if (!current) return "Choose a game from the PF2e Tavern Games library.";
  const player = playerId ? playerById(current, playerId) : null;
  const active = qualified(current, player);
  if (!active) return player ? "You are no longer eligible in this game." : "Use the GM controls to begin a new tavern game.";
  if (current.game === TAVERN_GAME_IDS.GOLEM) {
    if (current.phase === "golem-deal") return player?.id === current.dealerId ? "You are the dealer. Deal the next Golem hand when ready; marked cards can be used only if your actor has the required item." : "Wait for the Golem dealer to deal.";
    if (current.phase.startsWith("golem-betting")) return current.betting?.turnSeat === player?.seat ? "It is your betting turn. Bet, match, raise, or fold." : "Golem betting continues from the amulet.";
    if (current.phase === "golem-discard") return "Discard up to two cards, then receive replacements.";
    if (current.phase === "golem-showdown") return "The GM frees the golem and compares the best player hand with the discard hand.";
    return "The Golem hand is complete. The GM can begin the next hand if the pot carried forward.";
  }
  if (current.game === TAVERN_GAME_IDS.BOUNDER) {
    if (current.phase === "bounder-first-roll") return player?.id === current.shooterId ? "You are the shooter. Roll your first d20 to establish the point." : "Wait for the shooter to establish a point.";
    if (current.phase === "bounder-bets") return "Place a point or dealer side bet, or wait for the dealer roll.";
    if (current.phase === "bounder-second-roll") return player?.id === current.shooterId ? "Roll your second d20. You must put the dealer total between your two d20 results to bound the dealer." : "Wait for the shooter’s second roll.";
    return "Bounder is complete. The next clockwise participant becomes shooter.";
  }
  if (current.game === TAVERN_GAME_IDS.CENTURY) {
    if (current.phase === "century-select") return player?.predictions?.length >= 2 ? "Your Century selection is locked. Wait for the other selections." : "Choose two to ten distinct numbers from 1 to 100 and set your stake.";
    if (current.phase === "century-draw") return player?.id === current.dealerId ? "You are the dealer. Generate twenty unique numbers; loaded dice may choose them if your actor qualifies." : "Wait for the Century dealer’s twenty-number draw.";
    return "Century is complete. Compare your predictions to the twenty drawn numbers.";
  }
  if (current.game === TAVERN_GAME_IDS.ARM_WRESTLING) {
    if (current.phase === "arm-wrestling-ready") return player?.ready ? "You are ready. Wait for your opponent." : "Press Ready when you are prepared. Both wrestlers make blind Athletics checks together.";
    if (current.phase === "arm-wrestling-resolve") return "Both wrestlers are ready. The GM is resolving the opposed Athletics checks.";
    return `${current.result?.winnerName ?? "The winner"} has pinned the opponent. The match is complete.`;
  }
  if (current.game === TAVERN_GAME_IDS.SLAPPING) {
    if (current.phase === "slapping-round") return player?.id === current.strikerId ? "You are the striker. You have 60 seconds to deliver an open-handed slap below the eye and above the chin." : "You are receiving. Stay in position, do not flinch, raise your shoulder, or tuck your chin; you have 60 seconds to recover before your next turn.";
    return current.result?.winnerName ? `${current.result.winnerName} wins the Slapping bout by ${current.result.finish}.` : "The Slapping bout is an official draw.";
  }
  if (current.phase === "drinking-ready") return player?.ready ? "You are ready. Wait for all eligible drinkers to ready themselves." : "Choose Ready for this round. You can also elect to cheat, which treats your Fortitude result as a success but risks detection.";
  if (current.phase === "drinking-resolve") return "All participants are ready. The GM is resolving blind Performance checks and blind Fortitude saves.";
  return "The drinking contest has ended. Passed-out and disqualified participants lose; the final qualified participant wins.";
}

function gameRulesLink() {
  return `<a href="${GAME_SOURCE_URL}" target="_blank" rel="noopener noreferrer" class="tg-rules-link"><i class="fa-solid fa-book-open"></i> Golem, Bounder & Century rules</a>`;
}

function coinFields(prefix, copper = 0, label = "Stake") {
  const coins = copperToCoins(copper);
  return `<fieldset class="tg-coins"><legend>${escapeHTML(label)}</legend>${["pp", "gp", "sp", "cp"].map((denomination) => `<label>${denomination}<input type="number" min="0" step="1" value="${coins[denomination]}" data-coin="${prefix}-${denomination}"></label>`).join("")}</fieldset>`;
}

function coinsFrom(root, prefix) {
  return coinsToCopper(Object.fromEntries(["pp", "gp", "sp", "cp"].map((denomination) => [denomination, Number(root.querySelector(`[data-coin="${prefix}-${denomination}"]`)?.value ?? 0)])));
}

function publicGameBoard(current) {
  if (!current) return null;
  const common = {
    game: current.game,
    name: TAVERN_GAME_NAMES[current.game],
    gameNumber: current.gameNumber,
    round: current.round ?? null,
    phase: current.phase,
    phaseTitle: phaseTitle(current),
    players: current.players.map((entry) => ({ id: entry.id, actorId: entry.actorId, name: entry.name, seat: entry.seat, disqualified: entry.disqualified === true, folded: entry.folded === true, out: entry.out === true, ready: entry.ready === true, stage: entry.stage ?? null })),
    log: current.log?.slice(-8) ?? [],
    result: current.result ?? null,
  };
  if (current.game === TAVERN_GAME_IDS.GOLEM) return { ...common, potCp: current.potCp, anteCp: current.anteCp, dealerId: current.dealerId, amuletSeat: current.amuletSeat, betting: current.betting ? { ...current.betting, pending: undefined, roundBets: undefined } : null, discards: current.discards.map(() => ({ facedown: true })) };
  if (current.game === TAVERN_GAME_IDS.BOUNDER) return { ...common, shooterId: current.shooterId, point: current.point, shooterRolls: current.shooterRolls, dealerDice: current.dealerDice, dealerTotal: current.dealerTotal, shooterStakeCp: current.shooterStakeCp, bets: current.bets, result: current.result };
  if (current.game === TAVERN_GAME_IDS.CENTURY) return { ...common, dealerId: current.dealerId, minimumStakeCp: current.minimumStakeCp, drawn: current.phase === "century-complete" ? current.drawn : [], result: current.result };
  const publicBetting = current.betting ? { odds: current.betting.odds, locked: current.betting.locked, prizeCp: current.betting.prizeCp, suggestedPrizeCp: current.betting.suggestedPrizeCp, bets: (current.betting.bets ?? []).map((bet) => ({ actorId: bet.actorId, playerId: bet.playerId, amountCp: bet.amountCp, payoutCp: bet.payoutCp ?? null })), payouts: current.betting.payouts ?? [] } : null;
  if (current.game === TAVERN_GAME_IDS.ARM_WRESTLING) return { ...common, target: current.target, betting: publicBetting };
  if (current.game === TAVERN_GAME_IDS.SLAPPING) return { ...common, strikerId: current.strikerId, receiverId: current.receiverId, roundLimit: current.roundLimit, boutType: current.boutType, extraRound: current.extraRound, betting: publicBetting };
  return { ...common, fortitudeDC: current.fortitudeDC, betting: publicBetting };
}

function playerGameView(current, entry) {
  const entryActor = actor(entry.actorId);
  const base = { version: 1, actorId: entry.actorId, board: publicGameBoard(current), player: { id: entry.id, name: entry.name, seat: entry.seat, ready: entry.ready === true, disqualified: entry.disqualified === true, folded: entry.folded === true, out: entry.out === true, stage: entry.stage ?? null, result: entry.result ?? null } };
  if (current.game === TAVERN_GAME_IDS.GOLEM) {
    const marked = current.cheatingDealerId === entry.id;
    return {
      ...base,
      player: { ...base.player, hand: entry.hand, contributionCp: entry.contributionCp },
      markedCardVision: marked ? {
        hands: current.players.filter((other) => other.id !== entry.id).map((other) => ({ name: other.name, cards: other.hand })),
        discards: current.discards,
      } : null,
      choices: { canDeal: current.phase === "golem-deal" && entry.id === current.dealerId, canMarked: current.phase === "golem-deal" && entry.id === current.dealerId && hasMarkedCards(entryActor), markedOptions: current.phase === "golem-deal" && entry.id === current.dealerId && hasMarkedCards(entryActor) && current.gameNumber === 1 ? sortCardsForSelection(current.deck).map((card) => ({ id: card.id, label: cardLabel(card) })) : [], dealerHandOptions: current.phase === "golem-deal" && entry.id === current.dealerId ? sortCardsForSelection(current.deck).map((card) => ({ id: card.id, label: cardLabel(card) })) : [], dealerHandCardsNeeded: current.phase === "golem-deal" && entry.id === current.dealerId ? Math.max(0, 5 - entry.hand.length) : 0, betting: current.phase.startsWith("golem-betting") && current.betting?.turnSeat === entry.seat, canDiscard: current.phase === "golem-discard" && current.discardChoices?.[entry.id] === null },
    };
  }
  if (current.game === TAVERN_GAME_IDS.BOUNDER) return { ...base, choices: { shooterFirst: current.phase === "bounder-first-roll" && entry.id === current.shooterId, shooterSecond: current.phase === "bounder-second-roll" && entry.id === current.shooterId, canBet: current.phase === "bounder-bets", canDouble: current.phase === "bounder-bets" && entry.id === current.shooterId, loadedDice: entry.id === current.shooterId && hasLoadedDice(entryActor) }, };
  if (current.game === TAVERN_GAME_IDS.CENTURY) return { ...base, player: { ...base.player, predictions: entry.predictions, stakeCp: entry.stakeCp }, choices: { canChoose: current.phase === "century-select" && entry.predictions.length < 2, canDraw: current.phase === "century-draw" && entry.id === current.dealerId, loadedDice: entry.id === current.dealerId && hasLoadedDice(entryActor) } };
  if (current.game === TAVERN_GAME_IDS.ARM_WRESTLING) return { ...base, player: { ...base.player, grip: entry.grip, rollSubmitted: Boolean(current.armWrestlingRolls?.[entry.id]) }, choices: { canReady: current.phase === "arm-wrestling-ready" && !entry.ready && !entry.out && !entry.disqualified, canRoll: current.phase === "arm-wrestling-resolve" && entryActor?.type === "character" && !current.armWrestlingRolls?.[entry.id] && !entry.out && !entry.disqualified } };
  if (current.game === TAVERN_GAME_IDS.SLAPPING) return { ...base, player: { ...base.player, score: entry.score, role: entry.role, rollSubmitted: Boolean(current.slappingRolls?.[entry.id]) }, choices: { canRoll: current.phase === "slapping-round" && entryActor?.type === "character" && !current.slappingRolls?.[entry.id] && !entry.out && !entry.disqualified } };
  return { ...base, choices: { canReady: current.phase === "drinking-ready" && !entry.ready && !entry.out && !entry.disqualified } };
}

async function syncGameViews(current) {
  await game.settings.set(MODULE_ID, BOARD_KEY, publicGameBoard(current));
  for (const entry of current?.players ?? []) {
    const entryActor = actor(entry.actorId);
    if (entryActor?.setFlag) await entryActor.setFlag(MODULE_ID, VIEW_FLAG, playerGameView(current, entry));
  }
}

async function clearGameViews(current) {
  await game.settings.set(MODULE_ID, BOARD_KEY, null);
  for (const entry of current?.players ?? []) {
    const entryActor = actor(entry.actorId);
    if (!entryActor?.unsetFlag) continue;
    await entryActor.unsetFlag(MODULE_ID, VIEW_FLAG);
    await entryActor.unsetFlag(MODULE_ID, REQUEST_FLAG);
    await entryActor.unsetFlag(MODULE_ID, STATUS_FLAG);
  }
}

async function saveGame(next) {
  await game.settings.set(MODULE_ID, STATE_KEY, next);
  await syncGameViews(next);
  gameApp?.render({ force: true });
  playerApp?.render({ force: true });
  await announceResult(next);
}

function activeResults(current) {
  if (current?.game === TAVERN_GAME_IDS.GOLEM && current.phase === "golem-complete" && current.result?.winnerId) return [{ playerId: current.result.winnerId, amountCp: current.result.payoutCp, reason: current.result.reason }];
  if (current?.game === TAVERN_GAME_IDS.BOUNDER && current.phase === "bounder-complete") return current.result?.payouts ?? [];
  if (current?.game === TAVERN_GAME_IDS.CENTURY && current.phase === "century-complete") return (current.result ?? []).filter((entry) => entry.payoutCp > 0).map((entry) => ({ playerId: entry.playerId, amountCp: entry.payoutCp, reason: `${entry.matches} matches from ${entry.selected} selected numbers (×${entry.multiplier}).` }));
  if (competitiveGame(current) && current.phase === `${current.game}-complete` && current.result?.winnerId && current.betting?.prizeCp > 0) return [{ playerId: current.result.winnerId, amountCp: current.betting.prizeCp, reason: "winner purse" }];
  return [];
}

async function announceResult(current) {
  if (!isPrimaryGM() || current?.announcedResult === `${current.game}:${current.gameNumber}:${current.round ?? 0}:${current.phase}`) return;
  const results = activeResults(current);
  if (!results.length) return;
  current.announcedResult = `${current.game}:${current.gameNumber}:${current.round ?? 0}:${current.phase}`;
  await game.settings.set(MODULE_ID, STATE_KEY, current);
  const lines = results.map((entry) => `<li><strong>${escapeHTML(playerById(current, entry.playerId)?.name ?? "Unknown")}</strong> wins ${escapeHTML(formatCopper(entry.amountCp))}: ${escapeHTML(entry.reason)}</li>`).join("");
  await ChatMessage.create({ content: `<section class="tg-result"><h3>${escapeHTML(TAVERN_GAME_NAMES[current.game])} result</h3><ul>${lines}</ul></section>`, flags: { [MODULE_ID]: { resultAnnouncement: current.announcedResult } } });
}

async function rollStatisticBlind(entryActor, statistic, { dc = null, label = "Tavern game check", action = null, slug = null, extraRollOptions = [] } = {}) {
  const target = statistic === "fortitude" ? entryActor?.saves?.fortitude : entryActor?.skills?.[statistic];
  if (!target?.check?.roll) throw new Error(`${entryActor?.name ?? "Actor"} does not have a ${statistic} statistic to roll.`);
  const roll = await target.check.roll({ event: null, skipDialog: true, messageMode: "blindroll", dc: dc === null ? undefined : { value: dc }, ...(action ? { action } : {}), ...(slug ? { slug } : {}), extraRollOptions: [`tavern-game:${statistic}`, ...extraRollOptions], label });
  return { total: Number(roll?.total ?? 0), roll };
}

function cheatMethodControls(name) {
  return `<fieldset class="tg-cheat-method"><legend>Conceal the cheat with</legend><label><input type="radio" name="${escapeHTML(name)}" value="performance" checked> Performance</label><label><input type="radio" name="${escapeHTML(name)}" value="deception"> Deception — Create a Diversion</label></fieldset>`;
}

function selectedCheatMethod(root, name) {
  return root.querySelector(`input[name="${name}"]:checked`)?.value === "deception" ? "deception" : "performance";
}

function dealerHandSelectors(prefix, cards, count) {
  if (count <= 0) return "<p class=\"tg-muted\">Your carried cards already complete this hand.</p>";
  const options = `<option value="">Choose a card</option>${cards.map((card) => `<option value="${escapeHTML(card.id)}">${escapeHTML(card.label ?? cardLabel(card))}</option>`).join("")}`;
  return `<div class="tg-dealer-hand-fields"><p>Choose the ${count} card${count === 1 ? "" : "s"} needed to complete the Dealer’s hand.</p>${Array.from({ length: count }, (_entry, index) => `<label>Hand card ${index + 1}<select data-dealer-hand="${escapeHTML(prefix)}-${index}">${options}</select></label>`).join("")}</div>`;
}

async function rollConcealmentCheck(entryActor, method, label) {
  const deception = method === "deception";
  return rollStatisticBlind(entryActor, deception ? "deception" : "performance", {
    label: `${deception ? "Create a Diversion" : "Performance"} — ${label}`,
    ...(deception ? { action: "create-a-diversion", slug: "create-a-diversion", extraRollOptions: ["action:create-a-diversion", "trait:action:create-a-diversion"] } : { extraRollOptions: ["action:performance"] }),
  });
}

function degreeFromRoll(roll, dc) {
  const total = Number(roll?.total ?? 0);
  const difference = total - dc;
  let degree = difference >= 10 ? 3 : difference >= 0 ? 2 : difference <= -10 ? 0 : 1;
  const natural = Number(roll?.dice?.find((die) => die.faces === 20)?.results?.[0]?.result ?? 0);
  if (natural === 20) degree = Math.min(3, degree + 1);
  if (natural === 1) degree = Math.max(0, degree - 1);
  return ["criticalFailure", "failure", "success", "criticalSuccess"][degree];
}

function perceptionDC(entryActor) {
  return Number(entryActor?.perception?.dc?.value ?? entryActor?.perception?.dc ?? entryActor?.system?.attributes?.perception?.dc ?? 0);
}

async function whisperCheat(observer, cheater, gameName) {
  const observers = activeOwnerIds(actor(observer.actorId));
  const gms = game.users.filter((user) => user.active && user.isGM).map((user) => user.id);
  if (observers.length) await ChatMessage.create({ whisper: observers, content: `<p>You think <strong>${escapeHTML(cheater.name)}</strong> is cheating at ${escapeHTML(gameName)}.</p>`, flags: { [MODULE_ID]: { cheatNotice: true } } });
  if (gms.length) await ChatMessage.create({ whisper: gms, content: `<p><strong>${escapeHTML(observer.name)}</strong> noticed that <strong>${escapeHTML(cheater.name)}</strong> may be cheating at ${escapeHTML(gameName)}.</p>`, flags: { [MODULE_ID]: { cheatAudit: true } } });
}

async function detectCheating(current, cheater, concealmentRoll, gameName) {
  for (const observer of current.players.filter((entry) => entry.id !== cheater.id && qualified(current, entry))) {
    const dc = perceptionDC(actor(observer.actorId));
    if (dc > 0 && ["failure", "criticalFailure"].includes(degreeFromRoll(concealmentRoll, dc))) await whisperCheat(observer, cheater, gameName);
  }
}

const DRINKING_CONDITION_UUIDS = Object.freeze({
  clumsy: "Compendium.pf2e.conditionitems.Item.i3OJZU2nk64Df3xm",
  "off-guard": "Compendium.pf2e.conditionitems.Item.AJh5ex99aV6VTggg",
  sickened: "Compendium.pf2e.conditionitems.Item.fesd1n5eVhpCSS18",
  stupefied: "Compendium.pf2e.conditionitems.Item.e1XGnhKNSQIm5IXg",
  unconscious: "Compendium.pf2e.conditionitems.Item.fBnFDH2MTzgFijKf",
});

function drinkingConditionGrant(condition) {
  const uuid = DRINKING_CONDITION_UUIDS[condition.slug];
  if (!uuid) throw new Error(`No PF2E condition UUID is configured for ${condition.slug}.`);
  return {
    key: "GrantItem",
    uuid,
    allowDuplicate: true,
    onDeleteActions: { granter: "cascade", grantee: "detach" },
    ...(typeof condition.value === "number" ? { alterations: [{ mode: "override", property: "badge-value", value: condition.value }] } : {}),
  };
}

async function clearLegacyDrinkingRecords(entryActor, records) {
  for (const record of records) {
    const item = entryActor.items.get(record.itemId);
    if (!item) continue;
    if (record.created) await item.delete();
    else if (record.originalValue !== undefined) await item.update({ "system.value.value": record.originalValue });
  }
}

export async function applyDrinkingStage(entryActor, stageNumber) {
  const stage = drinkStage(stageNumber);
  await clearDrinkingEffects(entryActor);
  if (stage.stage <= 0) return;

  // This parent effect owns every contest condition it grants. PF2E's cascade action
  // deletes the linked condition documents whenever the effect is deleted manually,
  // on expiry, when changing stage, or when the table is closed.
  const effectSource = {
    name: `Drinking Contest — ${stage.name}`,
    type: "effect",
    img: `modules/${MODULE_ID}/assets/icons/drinking-contest-effect.png`,
    flags: { [MODULE_ID]: { drinkingStage: stage.stage, linkedConditions: true } },
    system: {
      slug: `tavern-games-drinking-stage-${stage.stage}`,
      duration: { value: stage.duration === "8 hours" ? 8 : 10, unit: stage.duration === "8 hours" ? "hours" : "minutes", expiry: "turn-start", sustained: false },
      start: { value: game.time.worldTime, initiative: null },
      tokenIcon: { show: false },
      rules: [
        ...(stage.stage === 1 || stage.stage === 2 ? [{ key: "FlatModifier", selector: "saving-throw", type: "item", value: 1, predicate: ["fear"], label: "Liquid Courage" }] : []),
        ...stage.conditions.map(drinkingConditionGrant),
      ],
    },
  };
  const [effect] = await entryActor.createEmbeddedDocuments("Item", [effectSource]);
  if (effect) await entryActor.setFlag(MODULE_ID, DRINKING_EFFECT_FLAG, { version: 2, effectId: effect.id, stage: stage.stage });
}

export async function clearDrinkingEffects(entryActor) {
  const previous = entryActor.getFlag(MODULE_ID, DRINKING_EFFECT_FLAG) ?? null;
  const effectId = Array.isArray(previous) ? null : previous?.effectId;
  const effect = effectId ? entryActor.items.get(effectId) : null;
  if (effect) await effect.delete();
  // This supports tables created by v2.1.7 and older, which tracked each condition
  // independently before the parent effect became the GrantItem granter.
  const legacyRecords = Array.isArray(previous) ? previous : previous?.records ?? [];
  await clearLegacyDrinkingRecords(entryActor, legacyRecords);
  await entryActor.unsetFlag(MODULE_ID, DRINKING_EFFECT_FLAG);
}

function cardMarkup(card, { selectable = false, selected = false } = {}) {
  if (!card) return "";
  const asset = `modules/${MODULE_ID}/${card.image}`;
  return `<button type="button" class="tg-card ${selectable ? "selectable" : ""} ${selected ? "selected" : ""}" data-card="${escapeHTML(card.id)}" title="${escapeHTML(cardLabel(card))}"><img src="${asset}" alt="${escapeHTML(cardLabel(card))}"><span>${escapeHTML(compactCardLabel(card))}</span></button>`;
}

function renderGolemCardTable(current) {
  if (current.game !== TAVERN_GAME_IDS.GOLEM) return "";
  const hands = current.players.map((entry) => `<article class="tg-golem-gm-hand ${entry.disqualified || entry.folded || entry.out ? "inactive" : ""}"><h4>${escapeHTML(entry.name)}${entry.id === current.dealerId ? " · Dealer" : ""}</h4><div class="tg-card-row">${entry.hand.map((card) => cardMarkup(card)).join("") || '<p class="tg-muted">No cards dealt.</p>'}</div></article>`).join("");
  const discards = current.discards?.length ? current.discards.map((card) => cardMarkup(card)).join("") : '<p class="tg-muted">No cards discarded.</p>';
  return `<section class="tg-golem-gm-cards"><h3>Golem cards <span class="tg-muted">GM view</span></h3><div class="tg-golem-gm-hands">${hands}</div><h4>Discard pile</h4><div class="tg-card-row">${discards}</div></section>`;
}

function renderGameHeader(current) {
  return `<header class="tg-banner"><div><h2>${escapeHTML(TAVERN_GAME_NAMES[current.game])}</h2><p>Game ${current.gameNumber}${current.round ? ` · Round ${current.round}` : ""} · ${escapeHTML(phaseTitle(current))}</p></div><div class="tg-header-actions">${gameRulesLink()}<button type="button" data-action="tg-close" class="danger"><i class="fa-solid fa-trash"></i> Close table</button></div></header>`;
}

function renderPlayers(current, { gm = false } = {}) {
  return `<section class="tg-players"><h3>Participants</h3>${current.players.map((entry) => `<article class="tg-player ${entry.disqualified || entry.out || entry.folded ? "inactive" : ""}"><div><strong>${escapeHTML(entry.name)}</strong><span>Seat ${entry.seat}${current.game === TAVERN_GAME_IDS.GOLEM && entry.seat === current.amuletSeat ? " · Amulet" : ""}${entry.id === current.dealerId ? " · Dealer" : ""}${entry.id === current.shooterId ? " · Shooter" : ""}</span></div><div>${entry.disqualified ? "Disqualified" : entry.out ? "Lost" : entry.folded ? "Folded" : current.game === TAVERN_GAME_IDS.DRINKING ? `${drinkStage(entry.stage).name} (Stage ${entry.stage})${entry.ready ? " · Ready" : ""}` : "Eligible"}${gm && !entry.disqualified ? `<button type="button" data-action="tg-disqualify" data-player="${entry.id}" class="danger tiny">Disqualify</button>` : ""}</div></article>`).join("")}</section>`;
}

function renderGolemGM(current) {
  const dealer = playerById(current, current.dealerId);
  if (current.phase === "golem-deal") {
    const markedCards = hasMarkedCards(actor(dealer.actorId));
    const markedControls = markedCards
      ? `<label class="tg-check"><input id="tg-golem-marked" type="checkbox"> ${current.gameNumber === 1 ? "Use marked playing cards to choose two opening cards" : "Use marked-card sight"}</label>${current.gameNumber === 1 ? `<div id="tg-golem-marked-options" class="tg-hidden"><p>Choose exactly two cards for the dealer’s opening hand.</p><select id="tg-golem-card-one">${sortCardsForSelection(current.deck).map((card) => `<option value="${card.id}">${escapeHTML(cardLabel(card))}</option>`).join("")}</select><select id="tg-golem-card-two">${sortCardsForSelection(current.deck).map((card) => `<option value="${card.id}">${escapeHTML(cardLabel(card))}</option>`).join("")}</select></div>` : `<p class="tg-muted">The hand is dealt randomly; marked-card sight reveals other hidden hands and the discard pile only to this Dealer.</p>`}`
      : `<p class="tg-muted">This Dealer does not have Marked Playing Cards; marked-card benefits are unavailable.</p>`;
    const socialControls = `<label class="tg-check"><input id="tg-golem-social-cheat" type="checkbox"> Cheat and choose the Dealer’s hand</label>${cheatMethodControls("tg-golem-cheat-method")}${dealerHandSelectors("tg-golem-dealer-hand", sortCardsForSelection(current.deck), Math.max(0, 5 - dealer.hand.length))}<p class="tg-muted">Any Dealer can choose their hand while cheating with a blind Performance or Deception (Create a Diversion) check. It grants no marked-card sight.</p>`;
    return `<section class="tg-controls"><h3>Dealer controls</h3><p>${escapeHTML(dealer.name)} deals the next Golem hand.</p>${markedControls}${socialControls}<button type="button" data-action="tg-golem-deal">Deal Golem hand</button></section>`;
  }
  if (current.phase.startsWith("golem-betting")) {
    const turn = current.players.find((entry) => entry.seat === current.betting.turnSeat);
    return `<section class="tg-controls"><h3>${escapeHTML(turn.name)}’s betting turn</h3><p>Current bet: <strong>${escapeHTML(formatCopper(current.betting.currentBet))}</strong></p><button data-action="tg-golem-match" data-player="${turn.id}">${current.betting.currentBet ? "Match" : "Pass"}</button><button data-action="tg-golem-fold" data-player="${turn.id}" class="danger">Fold</button>${coinFields("tg-golem-raise", current.betting.currentBet ? current.betting.currentBet + current.betting.minimumRaise : current.anteCp, "Bet / raise total")}<button data-action="tg-golem-raise" data-player="${turn.id}">Bet or raise</button></section>`;
  }
  if (current.phase === "golem-discard") return `<section class="tg-controls"><h3>Draw phase</h3><p>Players may discard up to two cards using their private panel. The GM may record a player’s choices from their hand panel if needed.</p></section>`;
  if (current.phase === "golem-showdown") return `<section class="tg-controls"><h3>Free the golem</h3><p>Compare the best active hand with the five-card hand formed from all discards.</p><button data-action="tg-golem-showdown">Reveal and resolve</button></section>`;
  return current.result ? `<section class="tg-controls"><h3>Golem result</h3><p>${escapeHTML(current.result.reason)}</p><button data-action="tg-golem-next">Prepare next Golem hand</button></section>` : "";
}

function renderBounderGM(current) {
  const shooter = playerById(current, current.shooterId);
  if (current.phase === "bounder-first-roll") return `<section class="tg-controls"><h3>Establish point</h3><p>${escapeHTML(shooter.name)} is the shooter. Their private panel can roll the first d20.</p><button data-action="tg-bounder-first" data-player="${shooter.id}">Roll first d20 for shooter</button></section>`;
  if (current.phase === "bounder-bets") return `<section class="tg-controls"><h3>Dealer roll</h3><p>Point: <strong>${current.point}</strong>. The shooter may double and gamblers may place bets in their player panels.</p><button data-action="tg-bounder-dealer">Roll dealer 3d6</button></section>`;
  if (current.phase === "bounder-second-roll") return `<section class="tg-controls"><h3>Second shooter roll</h3><p>Dealer total: <strong>${current.dealerTotal}</strong>. ${escapeHTML(shooter.name)} must roll their second d20.</p><button data-action="tg-bounder-second" data-player="${shooter.id}">Roll second d20 for shooter</button></section>`;
  return `<section class="tg-controls"><h3>Bounder result</h3>${(current.result?.payouts ?? []).length ? `<ul>${current.result.payouts.map((payout) => `<li>${escapeHTML(playerById(current, payout.playerId)?.name ?? "Unknown")}: ${escapeHTML(formatCopper(payout.amountCp))} — ${escapeHTML(payout.reason)}</li>`).join("")}</ul>` : "<p>No winning payouts this round.</p>"}<button data-action="tg-bounder-next">Next shooter</button></section>`;
}

function renderCenturyGM(current) {
  const dealer = playerById(current, current.dealerId);
  if (current.phase === "century-select") return `<section class="tg-controls"><h3>Awaiting selections</h3><p>Each participant selects two to ten numbers and a stake in their private panel.</p></section>`;
  if (current.phase === "century-draw") return `<section class="tg-controls"><h3>Century draw</h3><p>${escapeHTML(dealer.name)} draws twenty different numbers. Their private panel can choose the results if they have games-loaded-dice.</p><button data-action="tg-century-draw">Draw 20 numbers</button></section>`;
  return `<section class="tg-controls"><h3>Century results</h3><p>Numbers drawn: ${current.drawn.join(", ")}</p><ul>${(current.result ?? []).map((entry) => `<li>${escapeHTML(playerById(current, entry.playerId)?.name ?? "Unknown")}: ${entry.matches} match(es), ×${entry.multiplier}, ${escapeHTML(formatCopper(entry.payoutCp))}</li>`).join("")}</ul></section>`;
}

function renderArmWrestlingGM(current) {
  if (current.phase === "arm-wrestling-ready") return `<section class="tg-controls"><h3>Round ${current.round}</h3><p>Both wrestlers press Ready in their private panels. Each makes a blind Athletics check.</p>${current.players.filter((entry) => qualified(current, entry) && !entry.ready).map((entry) => `<button data-action="tg-arm-wrestling-ready" data-player="${entry.id}">Ready ${escapeHTML(entry.name)}</button>`).join(" ")}</section>`;
  if (current.phase === "arm-wrestling-resolve") {
    const pending = current.players.filter((entry) => qualified(current, entry) && actor(entry.actorId)?.type === "character" && !current.armWrestlingRolls?.[entry.id]);
    const submitted = current.players.filter((entry) => qualified(current, entry) && current.armWrestlingRolls?.[entry.id]);
    return `<section class="tg-controls"><h3>Resolve the struggle</h3><p>PC wrestlers receive a private request to roll Athletics from their actor-owner. NPC wrestlers roll automatically for the GM.</p>${submitted.length ? `<p>Submitted: ${submitted.map((entry) => escapeHTML(entry.name)).join(", ")}</p>` : ""}${pending.length ? `<p>Waiting for owner rolls: <strong>${pending.map((entry) => escapeHTML(entry.name)).join(", ")}</strong></p>` : "<p>All required results are available.</p>"}<button data-action="tg-arm-wrestling-resolve">Request PC rolls / roll NPCs</button></section>`;
  }
  return `<section class="tg-controls"><h3>Match complete</h3><p>${escapeHTML(current.result?.winnerName ?? "No winner") } wins with ${current.players.find((entry) => entry.id === current.result?.winnerId)?.grip ?? 0} grip points.</p></section>`;
}
function renderSlappingGM(current) {
  if (current.phase === "slapping-round") {
    const pending = current.players.filter((entry) => qualified(current, entry) && actor(entry.actorId)?.type === "character" && !current.slappingRolls?.[entry.id]);
    const submitted = current.players.filter((entry) => qualified(current, entry) && current.slappingRolls?.[entry.id]);
    const striker = playerById(current, current.strikerId);
    const receiver = playerById(current, current.receiverId);
    return `<section class="tg-controls"><h3>Round ${current.round} of ${current.roundLimit}</h3><p><strong>${escapeHTML(striker?.name)}</strong> strikes; <strong>${escapeHTML(receiver?.name)}</strong> receives. Each has 60 seconds for their action, followed by 60 seconds of recovery.</p><p>PC actors receive private owner requests. NPC actors roll automatically.</p>${submitted.length ? `<p>Submitted: ${submitted.map((entry) => `${escapeHTML(entry.name)} (${escapeHTML(entry.role)})`).join(", ")}</p>` : ""}${pending.length ? `<p>Waiting for owner rolls: <strong>${pending.map((entry) => escapeHTML(entry.name)).join(", ")}</strong></p>` : "<p>All required results are available.</p>"}<button data-action="tg-slapping-resolve">Request PC rolls / roll NPCs</button></section>`;
  }
  const winner = current.result?.winnerName ? `<p>${escapeHTML(current.result.winnerName)} wins by ${escapeHTML(current.result.finish)}.</p>` : "<p>The official result is a draw.</p>";
  return `<section class="tg-controls"><h3>Bout complete</h3>${winner}<p>Final scores: ${current.players.map((entry) => `${escapeHTML(entry.name)} ${entry.score}`).join(", ")}.</p></section>`;
}
function renderDrinkingGM(current) {
  if (current.phase === "drinking-ready") return `<section class="tg-controls"><h3>Round ${current.round} readiness</h3><p>Each eligible participant presses Ready in their player panel. The GM may ready a participant if needed.</p>${current.players.filter((entry) => qualified(current, entry) && !entry.ready).map((entry) => `<button data-action="tg-drink-ready" data-player="${entry.id}">Ready ${escapeHTML(entry.name)}</button>`).join(" ")}</section>`;
  if (current.phase === "drinking-resolve") return `<section class="tg-controls"><h3>Resolving drinks</h3><p>Every qualified contestant is ready. Blind Performance and Fortitude checks are resolving now against Fortitude DC <strong>${current.fortitudeDC}</strong>.</p><button data-action="tg-drink-resolve" class="tiny">Retry resolution if a check error interrupted the round</button></section>`;
  const winner = current.players.find((entry) => qualified(current, entry));
  return `<section class="tg-controls"><h3>Contest complete</h3><p>${winner ? `${escapeHTML(winner.name)} wins the drinking contest.` : "No participant remained standing."}</p><button data-action="tg-drink-clear-effects">Clear module drinking effects</button></section>`;
}

function renderCompetitiveBettingGM(current) {
  if (!competitiveGame(current) || !current.betting) return "";
  const adjustments = current.players.map((entry) => `<label>${escapeHTML(entry.name)} odds nudge (-5 to +5)<input type="number" min="-5" max="5" step="1" value="${Number(current.betting.oddsModifiers?.[entry.id] ?? 0)}" data-odds-player="${escapeHTML(entry.id)}" ${current.betting.locked ? "disabled" : ""}></label>`).join("");
  return `<section class="tg-controls tg-betting"><h3>Betting and winner purse</h3><p>Suggested winner purse: <strong>${escapeHTML(formatCopper(current.betting.suggestedPrizeCp))}</strong> · Current purse: <strong>${escapeHTML(formatCopper(current.betting.prizeCp))}</strong> · ${current.betting.locked ? "Odds locked" : "Odds are adjustable until the first wager"}.</p><p>${current.players.map((entry) => `${escapeHTML(entry.name)} ${formatOdds(current.betting.odds?.[entry.id])}`).join(" · ")}</p>${current.betting.locked ? "" : `<div class="tg-odds-fields">${adjustments}</div><button data-action="tg-update-competitive-odds">Apply odds nudges</button>`}</section>`;
}
function renderGMGame(current) {
  const controls = current.game === TAVERN_GAME_IDS.GOLEM ? renderGolemGM(current) : current.game === TAVERN_GAME_IDS.BOUNDER ? renderBounderGM(current) : current.game === TAVERN_GAME_IDS.CENTURY ? renderCenturyGM(current) : current.game === TAVERN_GAME_IDS.DRINKING ? renderDrinkingGM(current) : current.game === TAVERN_GAME_IDS.SLAPPING ? renderSlappingGM(current) : renderArmWrestlingGM(current);
  return `<div class="tg-table tg-gm-table">${renderGameHeader(current)}<section class="tg-phase"><h3>${escapeHTML(phaseTitle(current))}</h3><p>${escapeHTML(phaseInstructions(current))}</p></section>${renderCompetitiveBettingGM(current)}<div class="tg-layout">${renderPlayers(current, { gm: true })}<main>${controls}${renderGolemCardTable(current)}<section class="tg-log"><h3>Table log</h3><ol>${(current.log ?? []).slice(-8).map((entry) => `<li>${escapeHTML(entry)}</li>`).join("")}</ol></section></main></div></div>`;
}

function renderLibrary() {
  return `<div class="tg-library"><header class="tg-banner"><div><h2>PF2e Tavern Games</h2><p>Choose a table to open. Poppy’s Prize keeps its dedicated card-table interface.</p></div></header><section class="tg-game-grid"><article><h3>Poppy’s Prize</h3><p>Four-seat pirate poker with Pirates, Plunder, and marked cards.</p><button data-action="tg-open-poppy">Open Poppy’s Prize</button></article><article><h3>Golem</h3><p>Five-card draw against the central golem hand.</p><button data-action="tg-start" data-game="golem">Start Golem</button></article><article><h3>Bounder</h3><p>Bracket a dealer’s 3d6 total with two d20s.</p><button data-action="tg-start" data-game="bounder">Start Bounder</button></article><article><h3>Century</h3><p>Pick numbers and seek matches among twenty draws.</p><button data-action="tg-start" data-game="century">Start Century</button></article><article><h3>Drinking Contest</h3><p>Ready each round, survive the Fortitude DC, and remain standing.</p><button data-action="tg-start" data-game="drinking">Start Drinking Contest</button></article><article><h3>Arm Wrestling</h3><p>Opposed Athletics checks, grip points, and a first-to-ten pin.</p><button data-action="tg-start" data-game="arm-wrestling">Start Arm Wrestling</button></article><article><h3>Slapping</h3><p>Power Slap-inspired open-hand bouts with strikes, recovery, judge points, knockouts, and decisions.</p><button data-action="tg-start" data-game="slapping">Start Slapping</button></article></section>${gameRulesLink()}</div>`;
}

function renderBettingControls(board, actorId) {
  if (!competitiveGame(board) || !board.betting || board.phase === `${board.game}-complete`) return "";
  const alreadyBet = board.betting.bets?.some((bet) => bet.actorId === actorId);
  if (alreadyBet) return `<section class="tg-controls tg-betting"><h3>Betting</h3><p>This actor has already placed a wager. Odds are ${board.betting.locked ? "locked" : "open"}.</p></section>`;
  const options = board.players.filter((entry) => !entry.disqualified && !entry.out).map((entry) => `<option value="${escapeHTML(entry.id)}">${escapeHTML(entry.name)} — ${formatOdds(board.betting.odds?.[entry.id])}</option>`).join("");
  return `<section class="tg-controls tg-betting"><h3>Betting board</h3><p>Odds lock when the first wager is placed. A draw refunds all wagers.</p><label>Bet on <select id="tg-spectator-side">${options}</select></label>${coinFields("tg-spectator-bet", 100, "Wager") }<button data-action="tg-spectator-bet">Place fixed-odds bet</button></section>`;
}
function renderSpectatorGame(view) {
  const { board, player, choices } = view;
  return `<div class="tg-table tg-player-table"><header class="tg-banner"><h2>${escapeHTML(board.name)} — Betting</h2><p>${escapeHTML(board.phaseTitle)}</p></header><section class="tg-phase"><p>Betting actor: <strong>${escapeHTML(player.name)}</strong> · Level ${player.level} · Athletics ${player.athletics} · Fortitude ${player.fortitude}</p><p>${board.players.map((entry) => `${escapeHTML(entry.name)}: ${formatOdds(board.betting?.odds?.[entry.id])}`).join(" · ")}</p></section>${choices.canBet ? renderBettingControls(board, player.id) : "<p>Betting is closed.</p>"}${board.betting?.payouts?.length ? `<section class="tg-log"><h3>Your result</h3>${board.betting.payouts.filter((payout) => payout.actorId === player.id).map((payout) => `<p>${escapeHTML(payout.message)}</p>`).join("") || "<p>No payout recorded for this actor.</p>"}</section>` : ""}</div>`;
}
function renderPlayerGame(view) {
  if (!view) return `<div class="tg-empty"><h2>PF2e Tavern Games</h2><p>You are not assigned to an active tavern game.</p></div>`;
  const { board, player, choices } = view;
  if (view.spectator) return renderSpectatorGame(view);
  // Players never read the GM-restricted authoritative setting: the public board and actor-owned view are sufficient to render legal controls.
  const current = board;
  const showMarked = view.markedCardVision;
  let controls = "<p>Wait for your turn or the GM’s next instruction.</p>";
  if (board.game === TAVERN_GAME_IDS.GOLEM) {
    if (choices.canDeal) controls = `<button data-action="tg-player-golem-deal">Deal Golem hand</button>${choices.canMarked ? `<label class="tg-check"><input id="tg-player-golem-marked" type="checkbox"> Use marked playing cards</label>${choices.markedOptions?.length ? `<div id="tg-player-golem-marked-options" class="tg-hidden"><p>For game one only, choose exactly two cards for your opening hand.</p><select id="tg-player-golem-card-one">${choices.markedOptions.map((card) => `<option value="${card.id}">${escapeHTML(card.label)}</option>`).join("")}</select><select id="tg-player-golem-card-two">${choices.markedOptions.map((card) => `<option value="${card.id}">${escapeHTML(card.label)}</option>`).join("")}</select></div>` : ""}` : `<p class="tg-muted">You do not have Marked Playing Cards, so marked-card sight and marked-card selection are unavailable.</p>`}<label class="tg-check"><input id="tg-player-golem-social-cheat" type="checkbox"> Cheat and choose your hand</label>${cheatMethodControls("tg-player-golem-cheat-method")}${dealerHandSelectors("tg-player-golem-dealer-hand", choices.dealerHandOptions ?? [], choices.dealerHandCardsNeeded ?? 5)}<p class="tg-muted">Any Dealer can choose their hand while cheating with a blind Performance or Deception (Create a Diversion) check. It grants no marked-card sight.</p>`;
    else if (choices.betting) controls = `<button data-action="tg-player-golem-match">${current.betting?.currentBet ? "Match" : "Pass"}</button><button data-action="tg-player-golem-fold" class="danger">Fold</button>${coinFields("tg-player-golem-raise", current.betting?.currentBet ? current.betting.currentBet + current.betting.minimumRaise : current.anteCp, "Bet / raise total")}<button data-action="tg-player-golem-raise">Bet or raise</button>`;
    else if (choices.canDiscard) controls = `<p>Select up to two cards in your hand to discard.</p><button data-action="tg-player-golem-discard">Discard selected cards</button><button data-action="tg-player-golem-discard-none">Keep all cards</button>`;
    return `<div class="tg-table tg-player-table"><header class="tg-banner"><h2>Golem — Your Hand</h2></header><section class="tg-phase"><h3>${escapeHTML(board.phaseTitle)}</h3><p>${escapeHTML(phaseInstructions(current, player.id))}</p></section><section class="tg-hand"><h3>Your hand</h3><div>${player.hand.map((card) => cardMarkup(card, { selectable: choices.canDiscard })).join("")}</div></section>${renderBettingControls(current, view.actorId)}${showMarked ? `<section class="tg-marked"><h3>Marked-card sight</h3><p>Your marked cards reveal every other private Golem hand and the face-down discard pile.</p>${showMarked.hands.map((group) => `<h4>${escapeHTML(group.name)}’s hand</h4><div class="tg-marked-cards">${group.cards.map((card) => `<figure><figcaption>${escapeHTML(cardLabel(card))}</figcaption><img src="modules/${MODULE_ID}/assets/golem-cards/golem_card_back.png" alt="Face-down Golem card"></figure>`).join("")}</div>`).join("")}<h4>Discard pile</h4><div class="tg-marked-cards">${showMarked.discards.map((card) => `<figure><figcaption>${escapeHTML(cardLabel(card))}</figcaption><img src="modules/${MODULE_ID}/assets/golem-cards/golem_card_back.png" alt="Face-down Golem card"></figure>`).join("") || "<p>No cards discarded yet.</p>"}</div></section>` : ""}<section class="tg-controls">${controls}</section></div>`;
  }
  if (board.game === TAVERN_GAME_IDS.BOUNDER) {
    const diceOptions = Array.from({ length: 20 }, (_entry, index) => `<option value="${index + 1}">${index + 1}</option>`).join("");
    if (choices.shooterFirst) controls = choices.loadedDice ? `<label>Loaded first d20 <select id="tg-bounder-player-die">${diceOptions}</select></label><button data-action="tg-player-bounder-first">Set first d20</button>` : `<button data-action="tg-player-bounder-first">Roll first d20</button>`;
    else if (choices.shooterSecond) controls = choices.loadedDice ? `<label>Loaded second d20 <select id="tg-bounder-player-die">${diceOptions}</select></label><button data-action="tg-player-bounder-second">Set second d20</button>` : `<button data-action="tg-player-bounder-second">Roll second d20</button>`;
    else if (choices.canBet) controls = `${coinFields("tg-bounder-bet", 5, "Bet")}<label>Bet type <select id="tg-bounder-kind"><option value="point">Shooter bounds dealer</option><option value="even">Dealer all even</option><option value="odd">Dealer all odd</option><option value="triple">Dealer three alike</option></select></label><button data-action="tg-player-bounder-bet">Place bet</button>${choices.canDouble ? `<button data-action="tg-player-bounder-double">Double shooter stake</button>` : ""}`;
    return `<div class="tg-table tg-player-table"><header class="tg-banner"><h2>Bounder</h2><p>${escapeHTML(board.phaseTitle)}</p></header><section class="tg-phase"><p>${escapeHTML(phaseInstructions(current, player.id))}</p></section><section class="tg-controls">${controls}</section>${renderBettingControls(current, view.actorId)}</div>`;
  }
  if (board.game === TAVERN_GAME_IDS.CENTURY) {
    if (choices.canChoose) controls = `<label>Numbers (comma-separated, 2–10 from 1–100)<input id="tg-century-numbers" type="text" placeholder="4, 17, 42"></label>${coinFields("tg-century-stake", board.minimumStakeCp, "Stake")}<button data-action="tg-player-century-select">Lock selection</button>`;
    else if (choices.canDraw) controls = choices.loadedDice ? `<label>Twenty unique numbers (comma-separated)<textarea id="tg-century-loaded" rows="3" placeholder="1, 5, 12, ..."></textarea></label><button data-action="tg-player-century-draw">Set loaded-dice draw</button>` : `<button data-action="tg-player-century-draw">Draw 20 numbers</button>`;
    return `<div class="tg-table tg-player-table"><header class="tg-banner"><h2>Century</h2><p>${escapeHTML(board.phaseTitle)}</p></header><section class="tg-phase"><p>${escapeHTML(phaseInstructions(current, player.id))}</p></section>${player.predictions?.length ? `<p>Your numbers: <strong>${player.predictions.join(", ")}</strong></p>` : ""}<section class="tg-controls">${controls}</section></div>`;
  }
  if (board.game === TAVERN_GAME_IDS.SLAPPING) {
    if (choices.canRoll) controls = `<p>You are the ${player.role}. Roll your ${player.role === "striker" ? "Athletics strike" : "Fortitude recovery"} check privately for the GM.</p><button data-action="tg-player-slapping-roll">Roll ${player.role === "striker" ? "Slap" : "Recovery"}</button>`;
    else if (current.phase === "slapping-round" && player.rollSubmitted) controls = "<p>Your result was submitted. Wait for the other competitor and the GM.</p>";
    return `<div class="tg-table tg-player-table"><header class="tg-banner"><h2>Slapping</h2><p>Round ${board.round} of ${board.roundLimit} · ${escapeHTML(board.phaseTitle)}</p></header><section class="tg-phase"><p>${escapeHTML(phaseInstructions(current, player.id))}</p></section><section class="tg-controls"><p>Your role: <strong>${escapeHTML(player.role)}</strong> · Judge score: <strong>${player.score ?? 0}</strong></p>${controls}</section>${renderBettingControls(current, view.actorId)}</div>`;
  }
  if (board.game === TAVERN_GAME_IDS.ARM_WRESTLING) {
    if (choices.canReady) controls = `<p>Ready for round ${board.round}. First to ${board.target} grip points pins the opponent.</p><button data-action="tg-player-arm-wrestling-ready">Ready for round ${board.round}</button>`;
    else if (choices.canRoll) controls = `<p>The GM requested your Athletics check for round ${board.round}. Your result is sent privately to the GM.</p><button data-action="tg-player-arm-wrestling-roll">Roll Athletics</button>`;
    else if (current.phase === "arm-wrestling-resolve" && player.rollSubmitted) controls = "<p>Your Athletics result was submitted. Wait for the other wrestler and the GM to resolve the round.</p>";
    return `<div class="tg-table tg-player-table"><header class="tg-banner"><h2>Arm Wrestling</h2><p>${escapeHTML(board.phaseTitle)}</p></header><section class="tg-phase"><p>${escapeHTML(phaseInstructions(current, player.id))}</p></section><section class="tg-controls"><p>Your grip: <strong>${player.grip ?? 0}</strong> / ${board.target}</p>${controls}</section>${renderBettingControls(current, view.actorId)}</div>`;
  }
  if (choices.canReady) controls = `<label class="tg-check"><input id="tg-drink-cheat" type="checkbox"> Cheat (your Fortitude save is treated as a success)</label>${cheatMethodControls("tg-drink-cheat-method")}<p class="tg-muted">A blind Performance or Deception (Create a Diversion) check is compared privately with the other contestants’ Perception DCs.</p><button data-action="tg-player-drink-ready">Ready for round ${board.round}</button>`;
  return `<div class="tg-table tg-player-table"><header class="tg-banner"><h2>Drinking Contest</h2><p>Round ${board.round} · ${escapeHTML(board.phaseTitle)}</p></header><section class="tg-phase"><h3>${escapeHTML(drinkStage(player.stage ?? 0).name)} — Stage ${player.stage ?? 0}</h3><p>${escapeHTML(drinkStage(player.stage ?? 0).effect)} ${escapeHTML(phaseInstructions(current, player.id))}</p></section><section class="tg-controls">${controls}</section>${renderBettingControls(current, view.actorId)}</div>`;
}

class TavernGamesApplication extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = { id: "pf2e-tavern-games-table", classes: ["pf2e-tavern-games", "application", "tg-gm"], position: { width: 1020, height: 760 }, window: { title: "PF2e Tavern Games", icon: "fa-solid fa-dice", resizable: true } };
  async _renderHTML() { const element = document.createElement("div"); element.innerHTML = state() ? renderGMGame(state()) : renderLibrary(); return element; }
  _replaceHTML(result, content) { content.replaceChildren(result); }
  _onRender(context, options) { super._onRender(context, options); this.element.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", (event) => this.#act(event))); const marked = this.element.querySelector("#tg-golem-marked"); marked?.addEventListener("change", () => this.element.querySelector("#tg-golem-marked-options")?.classList.toggle("tg-hidden", !marked.checked)); }
  #act(event) {
    event.preventDefault();
    if (!isGM()) return ui.notifications.warn("Only the GM controls a tavern game table.");
    const button = event.currentTarget;
    const action = button.dataset.action;
    if (action === "tg-open-poppy") return game.modules.get(MODULE_ID)?.api?.openPoppys?.();
    if (action === "tg-start") return promptTavernGame(button.dataset.game);
    if (action === "tg-close") return closeTavernGame();
    if (action === "tg-disqualify") return promptDisqualify(button.dataset.player);
    return updateQueue(() => gmAction(action, button.dataset.player, this.element));
  }
}

class TavernPlayerApplication extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = { id: "pf2e-tavern-games-player", classes: ["pf2e-tavern-games", "application", "tg-player"], position: { width: 640, height: 700 }, window: { title: "PF2e Tavern Games — Your Game", icon: "fa-solid fa-dice", resizable: true } };
  async _renderHTML() { const element = document.createElement("div"); const entryActor = currentPlayerActor(); const view = playerApp?.spectator ? competitiveSpectatorView(game.settings.get(MODULE_ID, BOARD_KEY), entryActor) : entryActor?.getFlag(MODULE_ID, VIEW_FLAG); element.innerHTML = renderPlayerGame(view); return element; }
  _replaceHTML(result, content) { content.replaceChildren(result); }
  _onRender(context, options) { super._onRender(context, options); this.element.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", (event) => this.#act(event))); this.element.querySelectorAll(".tg-card.selectable").forEach((card) => card.addEventListener("click", () => card.classList.toggle("selected"))); const marked = this.element.querySelector("#tg-player-golem-marked"); marked?.addEventListener("change", () => this.element.querySelector("#tg-player-golem-marked-options")?.classList.toggle("tg-hidden", !marked.checked)); }
  async #act(event) {
    event.preventDefault();
    const action = event.currentTarget.dataset.action;
    const root = this.element;
    const payload = {};
    if (action === "tg-spectator-bet") { payload.playerId = root.querySelector("#tg-spectator-side")?.value; payload.amountCp = coinsFrom(root, "tg-spectator-bet"); return submitPlayerAction(action, payload); }
    if (action === "tg-player-slapping-roll") {
      const entryActor = currentPlayerActor();
      const view = entryActor?.getFlag(MODULE_ID, VIEW_FLAG);
      try {
        const statistic = view?.player?.role === "receiver" ? "fortitude" : "athletics";
        const target = statistic === "fortitude" ? entryActor?.saves?.fortitude : entryActor?.skills?.athletics;
        if (!target?.check?.roll) throw new Error(`${entryActor?.name ?? "This actor"} does not have the required ${statistic} statistic to roll.`);
        const roll = await target.check.roll({ event: null, skipDialog: true, messageMode: "blindroll", extraRollOptions: [`tavern-game:${statistic}`], label: `Slapping ${statistic}` });
        const natural = Number(roll?.dice?.find((die) => die.faces === 20)?.results?.[0]?.result ?? 0);
        await submitPlayerAction(action, { role: view?.player?.role, total: Number(roll?.total ?? 0), natural });
      } catch (error) {
        ui.notifications.error(error.message ?? "The Slapping check could not be rolled.");
      }
      return;
    }
    if (action === "tg-player-arm-wrestling-roll") {
      const entryActor = currentPlayerActor();
      try {
        const target = entryActor?.skills?.athletics;
        if (!target?.check?.roll) throw new Error(`${entryActor?.name ?? "This actor"} does not have an Athletics statistic to roll.`);
        const roll = await target.check.roll({ event: null, skipDialog: true, messageMode: "blindroll", extraRollOptions: ["tavern-game:athletics"], label: "Arm Wrestling Athletics" });
        const natural = Number(roll?.dice?.find((die) => die.faces === 20)?.results?.[0]?.result ?? 0);
        await submitPlayerAction(action, { total: Number(roll?.total ?? 0), natural });
      } catch (error) {
        ui.notifications.error(error.message ?? "The Athletics check could not be rolled.");
      }
      return;
    }
    if (action === "tg-player-golem-raise") payload.totalCp = coinsFrom(root, "tg-player-golem-raise");
    if (action === "tg-player-golem-discard") payload.cardIds = [...root.querySelectorAll(".tg-card.selected")].map((card) => card.dataset.card);
    if (action === "tg-player-bounder-first" || action === "tg-player-bounder-second") payload.result = root.querySelector("#tg-bounder-player-die")?.value ?? null;
    if (action === "tg-player-bounder-bet") { payload.kind = root.querySelector("#tg-bounder-kind")?.value; payload.amountCp = coinsFrom(root, "tg-bounder-bet"); }
    if (action === "tg-player-century-select") { payload.numbers = (root.querySelector("#tg-century-numbers")?.value ?? "").split(/[,\s]+/).filter(Boolean).map(Number); payload.stakeCp = coinsFrom(root, "tg-century-stake"); }
    if (action === "tg-player-century-draw") payload.numbers = (root.querySelector("#tg-century-loaded")?.value ?? "").split(/[,\s]+/).filter(Boolean).map(Number);
    if (action === "tg-player-drink-ready") { payload.cheat = root.querySelector("#tg-drink-cheat")?.checked === true; payload.concealment = selectedCheatMethod(root, "tg-drink-cheat-method"); }
    if (action === "tg-player-arm-wrestling-ready") payload.ready = true;
    if (action === "tg-player-golem-deal") { payload.marked = root.querySelector("#tg-player-golem-marked")?.checked === true; payload.socialCheat = root.querySelector("#tg-player-golem-social-cheat")?.checked === true; payload.markedCardIds = payload.marked ? [root.querySelector("#tg-player-golem-card-one")?.value, root.querySelector("#tg-player-golem-card-two")?.value].filter(Boolean) : []; payload.dealerHandCardIds = payload.socialCheat ? [...root.querySelectorAll('[data-dealer-hand^="tg-player-golem-dealer-hand-"]')].map((select) => select.value).filter(Boolean) : []; payload.concealment = selectedCheatMethod(root, "tg-player-golem-cheat-method"); }
    submitPlayerAction(action, payload);
  }
}

function openTavernGames() {
  if (!isGM()) return openTavernPlayer();
  gameApp ??= new TavernGamesApplication();
  return gameApp.render({ force: true });
}

function openTavernPlayer(entryActor = null) {
  if (isGM()) return openTavernGames();
  const target = entryActor ?? currentPlayerActor();
  if (!target?.isOwner) return ui.notifications.warn("Choose an owned actor to open the PF2e Tavern Games panel.");
  const current = game.settings.get(MODULE_ID, BOARD_KEY) ?? state();
  const participantView = target.getFlag(MODULE_ID, VIEW_FLAG);
  if (!participantView && !competitiveGame(current)) return ui.notifications.warn("You are not assigned to an active tavern game.");
  playerApp ??= new TavernPlayerApplication();
  playerApp.actorId = target.id;
  playerApp.spectator = !participantView && competitiveGame(current);
  return playerApp.render({ force: true });
}

function participantLimits(gameId) {
  if (gameId === TAVERN_GAME_IDS.GOLEM) return { minimum: 3, maximum: 6 };
  if ([TAVERN_GAME_IDS.ARM_WRESTLING, TAVERN_GAME_IDS.SLAPPING].includes(gameId)) return { minimum: 2, maximum: 2 };
  return { minimum: 2, maximum: 20 };
}

function promptTavernGame(gameId) {
  const label = TAVERN_GAME_NAMES[gameId];
  if (!label) return;
  const { minimum, maximum } = participantLimits(gameId);
  const content = `<form class="tg-start tg-participant-count"><p>Choose how many actors will play ${escapeHTML(label)}. You will select each actor individually on the next screen.</p><label>Number of participants <input name="participantCount" type="number" min="${minimum}" max="${maximum}" value="${minimum}" required></label><p class="notes">${escapeHTML(label)} supports ${minimum}–${maximum} PC or NPC participants.</p></form>`;
  new foundry.applications.api.DialogV2({ window: { title: `PF2e Tavern Games — ${label} participants` }, content, buttons: [{ action: "next", label: "Choose participants", default: true, callback: (_event, button) => Number(button.form.elements.participantCount.value) }], submit: (count) => { if (!Number.isInteger(count) || count < minimum || count > maximum) return ui.notifications.warn(`Choose between ${minimum} and ${maximum} participants.`); return promptTavernParticipantSelection(gameId, count); } }).render({ force: true });
}

function promptTavernParticipantSelection(gameId, count) {
  const label = TAVERN_GAME_NAMES[gameId];
  const controlledIds = controlledTokenActorIds();
  const actorOptions = participantOptions();
  const dealerOptions = participantOptions({ includeDummy: false, selectedId: controlledIds[0] ?? null });
  const dealerLabel = [TAVERN_GAME_IDS.DRINKING, TAVERN_GAME_IDS.ARM_WRESTLING, TAVERN_GAME_IDS.SLAPPING].includes(gameId) ? null : gameId === TAVERN_GAME_IDS.BOUNDER ? "First Shooter" : "Dealer / deck owner";
  const specific = gameId === TAVERN_GAME_IDS.DRINKING ? `<label>Fortitude DC <input name="dc" type="number" min="0" value="15" required></label>` : gameId === TAVERN_GAME_IDS.ARM_WRESTLING ? `<p class="notes">Arm Wrestling uses two participants and opposed Athletics checks; no stake is required.</p>` : gameId === TAVERN_GAME_IDS.SLAPPING ? `<label>Bout type <select name="boutType"><option value="standard">Standard bout — 3 rounds</option><option value="title">Title bout — 5 rounds</option></select></label>` : coinFields("tg-start-stake", 5, gameId === TAVERN_GAME_IDS.CENTURY ? "Minimum stake" : gameId === TAVERN_GAME_IDS.BOUNDER ? "Shooter stake" : "Ante");
  const selectors = Array.from({ length: count }, (_entry, index) => `<label>Character ${index + 1}<select name="participant-${index + 1}" data-participant required>${participantOptions({ selectedId: controlledIds[index] ?? null })}</select></label>`).join("");
  const tokenNote = controlledIds.length ? `<p class="notes">${controlledIds.length} controlled token actor${controlledIds.length === 1 ? " is" : "s are"} preselected. You can change any selection before starting.</p>` : '<p class="notes">Control tokens on the canvas before opening this dialog to preselect their actors.</p>';
  const content = `<form class="tg-start"><p>Select each of the ${count} participants. Options are ordered with <strong>- Dummy</strong> first, then Party Members, then other eligible actors alphabetically.</p><div class="tg-participant-selectors">${selectors}</div>${tokenNote}${dealerLabel ? `<label>${dealerLabel}<select name="dealer" required>${dealerOptions}</select></label><p class="notes">The selected ${dealerLabel.toLowerCase()} must be one of the chosen participants.</p>` : ""}${specific}${[TAVERN_GAME_IDS.ARM_WRESTLING, TAVERN_GAME_IDS.SLAPPING, TAVERN_GAME_IDS.DRINKING].includes(gameId) ? `${coinFields("tg-prize", 0, "Winner purse (leave 0 for suggested)")}<label class="tg-check"><input name="autoCurrency" type="checkbox"> Automatically transfer spectator wagers and winner purse</label><p class="notes">The suggested purse uses silver as the common unit: 1 sp for an unskilled baseline, 5 sp for a skilled baseline, plus level, relevant-statistic, and title-bout premiums; you may edit it; you may edit it.</p>` : ""}<p class="notes">Players need Owner permission on their actor to use a private panel.</p></form>`;
  new foundry.applications.api.DialogV2({ window: { title: `PF2e Tavern Games — Set up ${label}` }, content, buttons: [{ action: "start", label: `Start ${label}`, default: true, callback: (_event, button) => { const form = button.form; return { actorIds: [...form.querySelectorAll("[data-participant]")].map((select) => select.value), dealerId: form.elements.dealer?.value ?? null, stakeCp: [TAVERN_GAME_IDS.DRINKING, TAVERN_GAME_IDS.ARM_WRESTLING, TAVERN_GAME_IDS.SLAPPING].includes(gameId) ? null : coinsFrom(form, "tg-start-stake"), boutType: form.elements.boutType?.value ?? null, prizeCp: [TAVERN_GAME_IDS.ARM_WRESTLING, TAVERN_GAME_IDS.SLAPPING, TAVERN_GAME_IDS.DRINKING].includes(gameId) ? coinsFrom(form, "tg-prize") : null, autoCurrency: form.elements.autoCurrency?.checked === true, dc: Number(form.elements.dc?.value ?? 15) }; } }], submit: (result) => startTavernGame(gameId, result) }).render({ force: true });
}

async function startTavernGame(gameId, result) {
  return updateQueue(async () => {
    if (!result) return;
    if (state()) throw new Error("Close the active PF2e Tavern Games table before starting another game.");
    if (!Array.isArray(result.actorIds) || result.actorIds.some((id) => !id)) throw new Error("Choose an actor in every participant selector; - Dummy is not valid after choosing a participant count.");
    if (new Set(result.actorIds).size !== result.actorIds.length) throw new Error("Each participant selector must use a different actor.");
    const participants = result.actorIds.map((id) => { const entryActor = actor(id); if (!entryActor) throw new Error("A selected actor is no longer available."); return { id: entryActor.id, actorId: entryActor.id, name: entryActor.name }; });
    let next;
    if (gameId === TAVERN_GAME_IDS.GOLEM) next = createGolemGame({ participants, dealerId: result.dealerId, anteCp: result.stakeCp });
    else if (gameId === TAVERN_GAME_IDS.BOUNDER) next = createBounderGame({ participants, shooterId: result.dealerId, stakeCp: result.stakeCp });
    else if (gameId === TAVERN_GAME_IDS.CENTURY) next = createCenturyGame({ participants, dealerId: result.dealerId, minimumStakeCp: result.stakeCp });
    else if (gameId === TAVERN_GAME_IDS.ARM_WRESTLING) next = createArmWrestlingGame({ participants });
    else if (gameId === TAVERN_GAME_IDS.SLAPPING) next = createSlappingGame({ participants, boutType: result.boutType });
    else next = createDrinkingGame({ participants, fortitudeDC: result.dc });
    if ([TAVERN_GAME_IDS.ARM_WRESTLING, TAVERN_GAME_IDS.SLAPPING, TAVERN_GAME_IDS.DRINKING].includes(gameId)) next.betting = initCompetitiveBetting(next, result);
    await saveGame(next);
    openTavernGames();
  });
}

async function closeTavernGame() {
  const current = state();
  if (!current) return;
  const confirmed = await foundry.applications.api.DialogV2.confirm({ window: { title: "Close PF2e Tavern Games table" }, content: "<p>Close this table? This clears its player views. Drinking-stage conditions created by this module remain until cleared from the final screen or an actor sheet.</p>", yes: { label: "Close table", icon: "fa-solid fa-trash" }, no: { label: "Keep playing" } });
  if (!confirmed) return;
  await updateQueue(async () => { await clearGameViews(current); await game.settings.set(MODULE_ID, STATE_KEY, null); gameApp?.render({ force: true }); playerApp?.render({ force: true }); });
}

function promptDisqualify(playerId) {
  const current = state();
  const entry = playerById(current, playerId);
  if (!entry) return;
  const content = `<form><p>Disqualify <strong>${escapeHTML(entry.name)}</strong> from ${escapeHTML(TAVERN_GAME_NAMES[current.game])}?</p><label>Reason <input name="reason" value="Disqualified by the GM"></label></form>`;
  new foundry.applications.api.DialogV2({ window: { title: "Disqualify participant" }, content, buttons: [{ action: "confirm", label: "Disqualify", icon: "fa-solid fa-ban", callback: (_event, button) => button.form.elements.reason.value }], submit: (reason) => updateQueue(async () => { const next = disqualifyTavernPlayer(state(), playerId, reason); if (next.game === TAVERN_GAME_IDS.DRINKING) await clearDrinkingEffects(actor(entry.actorId)); await saveGame(next); await ChatMessage.create({ content: `<p><strong>${escapeHTML(entry.name)}</strong> was disqualified from ${escapeHTML(TAVERN_GAME_NAMES[next.game])}: ${escapeHTML(reason)}.</p>` }); }) }).render({ force: true });
}

function diceResult(entryActor, supplied, sides) {
  if (hasLoadedDice(entryActor) && supplied !== null && supplied !== undefined && supplied !== "") {
    const chosen = Number(supplied);
    if (Number.isInteger(chosen) && chosen >= 1 && chosen <= sides) return chosen;
    throw new Error(`Loaded dice result must be between 1 and ${sides}.`);
  }
  return Math.floor(Math.random() * sides) + 1;
}

async function gmAction(action, playerId, root) {
  const current = state();
  if (!current) return;
  let next = current;
  if (action === "tg-update-competitive-odds") {
    if (!competitiveGame(current) || current.betting?.locked) throw new Error("Odds can only be adjusted before the first spectator wager.");
    const oddsModifiers = Object.fromEntries(current.players.map((entry) => [entry.id, Math.max(-5, Math.min(5, Number(root.querySelector(`[data-odds-player="${entry.id}"]`)?.value ?? 0)))]));
    next = { ...current, betting: { ...current.betting, oddsModifiers, odds: competitiveOdds(current, oddsModifiers) } };
  } else if (action === "tg-golem-deal") {
    const dealerActor = actor(current.dealerId);
    const marked = root.querySelector("#tg-golem-marked")?.checked === true && hasMarkedCards(dealerActor);
    const socialCheat = root.querySelector("#tg-golem-social-cheat")?.checked === true;
    const cheating = marked || socialCheat;
    const concealment = selectedCheatMethod(root, "tg-golem-cheat-method");
    const ids = marked && current.gameNumber === 1 ? [root.querySelector("#tg-golem-card-one")?.value, root.querySelector("#tg-golem-card-two")?.value] : [];
    const dealerHandCardIds = socialCheat ? [...root.querySelectorAll('[data-dealer-hand^="tg-golem-dealer-hand-"]')].map((select) => select.value).filter(Boolean) : [];
    if (socialCheat && dealerHandCardIds.length !== Math.max(0, 5 - playerById(current, current.dealerId).hand.length)) throw new Error("Choose every card needed to complete the Dealer’s hand when cheating.");
    next = dealGolem(current, { markedCardIds: ids.filter(Boolean), dealerHandCardIds });
    if (marked) next.cheatingDealerId = next.dealerId;
    await markedCardCheck(next, playerById(next, next.dealerId), cheating, concealment);
  }   else if (action === "tg-golem-match") next = golemBet(current, playerId, current.betting.currentBet ? "match" : "pass");
  else if (action === "tg-golem-fold") next = golemBet(current, playerId, "fold").state;
  else if (action === "tg-golem-raise") next = golemBet(current, playerId, current.betting.currentBet ? "raise" : "bet", coinsFrom(root, "tg-golem-raise")).state;
  else if (action === "tg-golem-showdown") { next = resolveGolem(current); if (next.result?.penaltyCp) ui.notifications.info(`${playerById(next, next.result.winnerId)?.name} adds ${formatCopper(next.result.penaltyCp)} to the pot.`); }
  else if (action === "tg-golem-next") next = nextGolemHand(current);
  else if (action === "tg-bounder-first") { const shooter = playerById(current, current.shooterId); next = bounderFirstRoll(current, diceResult(actor(shooter.actorId), null, 20)); }
  else if (action === "tg-bounder-dealer") next = bounderDealerRoll(current);
  else if (action === "tg-bounder-second") { const shooter = playerById(current, current.shooterId); next = bounderSecondRoll(current, diceResult(actor(shooter.actorId), null, 20)); }
  else if (action === "tg-bounder-next") next = nextBounderGame(current);
  else if (action === "tg-century-draw") next = centuryDraw(current);
  else if (action === "tg-drink-ready") { next = setDrinkingReady(current, playerId, true); if (next.phase === "drinking-resolve") next = await resolveDrinks(next); }
  else if (action === "tg-arm-wrestling-ready") next = setArmWrestlingReady(current, playerId, true);
  else if (action === "tg-arm-wrestling-resolve") next = await resolveArmWrestling(current);
  else if (action === "tg-slapping-resolve") next = await resolveSlapping(current);
  else if (action === "tg-drink-resolve") next = await resolveDrinks(current);
  else if (action === "tg-drink-clear-effects") { for (const entrant of current.players) await clearDrinkingEffects(actor(entrant.actorId)); return; }
  if (next?.state) next = next.state;
  next = await settleCompetitiveBets(next);
  await saveGame(next);
}

async function markedCardCheck(current, cheater, cheating, concealment = "performance") {
  if (!cheating) return null;
  const entryActor = actor(cheater.actorId);
  const check = await rollConcealmentCheck(entryActor, concealment, "Golem cheating");
  await detectCheating(current, cheater, check.roll, "Golem");
  return check;
}

function opposedAthleticsDegrees(first, second) {
  const difference = Number(first.total ?? 0) - Number(second.total ?? 0);
  if (difference === 0) return ["failure", "failure"];
  const firstNatural = Number(first.natural ?? first.roll?.dice?.find((die) => die.faces === 20)?.results?.[0]?.result ?? 0);
  const secondNatural = Number(second.natural ?? second.roll?.dice?.find((die) => die.faces === 20)?.results?.[0]?.result ?? 0);
  let firstDegree = difference >= 10 ? "criticalSuccess" : "success";
  let secondDegree = difference <= -10 ? "criticalSuccess" : "success";
  if (difference < 0) firstDegree = Math.abs(difference) >= 10 ? "criticalFailure" : "failure";
  if (difference > 0) secondDegree = Math.abs(difference) >= 10 ? "criticalFailure" : "failure";
  if (firstNatural === 20) firstDegree = firstDegree === "success" ? "criticalSuccess" : firstDegree;
  if (firstNatural === 1) firstDegree = firstDegree === "failure" ? "criticalFailure" : firstDegree;
  if (secondNatural === 20) secondDegree = secondDegree === "success" ? "criticalSuccess" : secondDegree;
  if (secondNatural === 1) secondDegree = secondDegree === "failure" ? "criticalFailure" : secondDegree;
  return [firstDegree, secondDegree];
}
async function resolveArmWrestling(current) {
  if (current.game !== TAVERN_GAME_IDS.ARM_WRESTLING || current.phase !== "arm-wrestling-resolve") return current;
  const wrestlers = current.players.filter((entry) => qualified(current, entry));
  const rolls = { ...(current.armWrestlingRolls ?? {}) };
  for (const wrestler of wrestlers) {
    if (rolls[wrestler.id]) continue;
    const entryActor = actor(wrestler.actorId);
    if (entryActor?.type === "character") continue;
    const check = await rollStatisticBlind(entryActor, "athletics", { label: "Arm Wrestling Athletics" });
    rolls[wrestler.id] = { total: check.total, natural: Number(check.roll?.dice?.find((die) => die.faces === 20)?.results?.[0]?.result ?? 0), source: "gm-npc" };
  }
  const waiting = wrestlers.filter((wrestler) => !rolls[wrestler.id]);
  const next = { ...current, armWrestlingRolls: rolls };
  if (waiting.length) {
    next.log = [...(current.log ?? []), `Arm Wrestling round ${current.round} is waiting for Athletics rolls from: ${waiting.map((entry) => entry.name).join(", ")}.`];
    return next;
  }
  const attempts = wrestlers.map((wrestler) => ({ playerId: wrestler.id, ...rolls[wrestler.id] }));
  const [firstDegree, secondDegree] = opposedAthleticsDegrees(attempts[0], attempts[1]);
  return resolveArmWrestlingRound(next, attempts.map((attempt, index) => ({ playerId: attempt.playerId, total: attempt.total, natural: attempt.natural, degree: index === 0 ? firstDegree : secondDegree })));
}

async function resolveSlapping(current) {
  if (current.game !== TAVERN_GAME_IDS.SLAPPING || current.phase !== "slapping-round") return current;
  const rolls = { ...(current.slappingRolls ?? {}) };
  const striker = playerById(current, current.strikerId);
  const receiver = playerById(current, current.receiverId);
  for (const [entry, statistic, role] of [[striker, "athletics", "striker"], [receiver, "fortitude", "receiver"]]) {
    if (rolls[entry.id]) continue;
    const entryActor = actor(entry.actorId);
    if (entryActor?.type === "character") continue;
    const check = await rollStatisticBlind(entryActor, statistic, { label: `Slapping ${role}` });
    rolls[entry.id] = { role, total: check.total, natural: Number(check.roll?.dice?.find((die) => die.faces === 20)?.results?.[0]?.result ?? 0), source: "gm-npc" };
  }
  const pending = [striker, receiver].filter((entry) => !rolls[entry.id]);
  const next = { ...current, slappingRolls: rolls };
  if (pending.length) {
    next.log = [...(current.log ?? []), `Slapping round ${current.round} is waiting for owner checks from: ${pending.map((entry) => entry.name).join(", ")}.`];
    return next;
  }
  const strike = rolls[striker.id];
  const receive = rolls[receiver.id];
  const [strikeDegree, receiveDegree] = opposedAthleticsDegrees(strike, receive);
  return resolveSlappingRound(next, [{ playerId: striker.id, total: strike.total, natural: strike.natural, degree: strikeDegree }, { playerId: receiver.id, total: receive.total, natural: receive.natural, degree: receiveDegree }]);
}

async function resolveDrinks(current) {
  const contestants = current.players.filter((entry) => qualified(current, entry));
  const attempts = await Promise.all(contestants.map(async (contestant) => {
    const entryActor = actor(contestant.actorId);
    const cheatRequest = current.drinkingCheats?.[contestant.id];
    const cheat = cheatRequest === true || cheatRequest?.cheated === true;
    const concealment = cheatRequest?.concealment === "deception" ? "deception" : "performance";
    const [performance, fortitude] = await Promise.all([
      cheat ? rollConcealmentCheck(entryActor, concealment, "Drinking Contest cheating") : rollStatisticBlind(entryActor, "performance", { label: "Drinking Contest Performance" }),
      cheat ? Promise.resolve({ total: null, roll: null }) : rollStatisticBlind(entryActor, "fortitude", { dc: current.fortitudeDC, label: "Drinking Contest Fortitude" }),
    ]);
    return { contestant, cheat, concealment, performance, fortitude };
  }));
  await Promise.all(attempts.filter((attempt) => attempt.cheat).map((attempt) => detectCheating(current, attempt.contestant, attempt.performance.roll, "the drinking contest")));
  const resolutions = attempts.map(({ contestant, cheat, concealment, performance, fortitude }) => ({
    playerId: contestant.id,
    performanceTotal: performance.total,
    fortitudeTotal: fortitude.total,
    fortitudeDegree: cheat ? "success" : degreeFromRoll(fortitude.roll, current.fortitudeDC),
    cheated: cheat,
    concealment,
  }));
  const next = resolveDrinkingRound(current, resolutions);
  await Promise.all(next.players.map((contestant) => applyDrinkingStage(actor(contestant.actorId), contestant.stage)));
  next.drinkingCheats = {};
  return next;
}

async function settleCompetitiveBets(current) {
  if (!competitiveGame(current) || !current.result || !current.betting || current.betting.settled) return current;
  const winnerId = current.result.winnerId ?? null;
  const payouts = (current.betting.bets ?? []).map((bet) => {
    const amountCp = winnerId === null ? bet.amountCp : bet.playerId === winnerId ? Math.round(bet.amountCp * Number(bet.odds ?? 1)) : 0;
    return { ...bet, payoutCp: amountCp, message: winnerId === null ? `Draw: your ${formatCopper(bet.amountCp)} wager was refunded.` : amountCp ? `Your ${formatCopper(bet.amountCp)} wager paid ${formatCopper(amountCp)} at ${formatOdds(bet.odds)}.` : `Your ${formatCopper(bet.amountCp)} wager did not win.` };
  });
  if (current.betting.autoCurrency) {
    for (const payout of payouts.filter((entry) => entry.payoutCp > 0)) await actor(payout.actorId)?.inventory?.addCurrency?.(copperToCoins(payout.payoutCp));
    const winner = winnerId ? playerById(current, winnerId) : null;
    if (winner && current.betting.prizeCp > 0) await actor(winner.actorId)?.inventory?.addCurrency?.(copperToCoins(current.betting.prizeCp));
  }
  for (const payout of payouts) {
    const recipient = payout.userId ? game.users.get(payout.userId) : null;
    if (!recipient) continue;
    await ChatMessage.create({ whisper: [recipient.id], content: `<p><strong>${escapeHTML(TAVERN_GAME_NAMES[current.game])} betting result</strong></p><p>${escapeHTML(payout.message)}</p>${current.betting.autoCurrency && payout.payoutCp > 0 ? "<p>The payout was transferred automatically to your actor.</p>" : ""}`, flags: { [MODULE_ID]: { bettingPayout: true, game: current.game, gameNumber: current.gameNumber } } });
  }
  return { ...current, betting: { ...current.betting, settled: true, payouts, prizePaid: Boolean(winnerId && current.betting.prizeCp > 0) } };
}

async function submitPlayerAction(action, payload = {}) {
  const entryActor = currentPlayerActor();
  if (!entryActor) return ui.notifications.warn("You are not assigned to an active PF2e Tavern Games table.");
  await entryActor.setFlag(MODULE_ID, STATUS_FLAG, { kind: "pending", message: "Action sent to the GM for validation." });
  await entryActor.setFlag(MODULE_ID, REQUEST_FLAG, { id: foundry.utils.randomID(), action, payload, requestedAt: Date.now() });
  playerApp?.render({ force: true });
}

async function processPlayerAction(entryActor, request, userId) {
  if (!isPrimaryGM() || !request?.id || !request.action) return;
  const user = game.users.get(userId);
  if (!user || user.isGM || !entryActor.testUserPermission(user, "OWNER")) return;
  await updateQueue(async () => {
    const current = state();
    const entrant = playerForActor(current, entryActor.id);
    const payload = request.payload ?? {};
    if (request.action === "tg-spectator-bet") {
      if (!current || !competitiveGame(current)) throw new Error("Betting is not available for this table.");
      if (entryActor.type !== "character" && !entrant) throw new Error("Spectator betting requires a PC actor.");
      if (current.phase === `${current.game}-complete`) throw new Error("Betting is closed.");
      if (current.betting?.bets?.some((bet) => bet.actorId === entryActor.id)) throw new Error("This actor has already placed a wager.");
      const target = current.players.find((entry) => entry.id === payload.playerId && qualified(current, entry));
      const amountCp = Number(payload.amountCp);
      if (!target || !Number.isSafeInteger(amountCp) || amountCp <= 0) throw new Error("Choose a competitor and a positive wager.");
      const betting = { ...current.betting, locked: true, bets: [...(current.betting?.bets ?? []), { actorId: entryActor.id, userId: user.id, playerId: target.id, amountCp, odds: current.betting.odds[target.id] }] };
      if (betting.autoCurrency) await entryActor.inventory.removeCurrency(copperToCoins(amountCp), { byValue: true });
      await entryActor.unsetFlag(MODULE_ID, REQUEST_FLAG);
      await entryActor.setFlag(MODULE_ID, STATUS_FLAG, { kind: "accepted", message: `Wager placed on ${target.name}.` });
      await saveGame({ ...current, betting });
      return;
    }
    if (!current || !entrant || !qualified(current, entrant)) return;
    let next = current;
    if (request.action === "tg-player-golem-deal" && entrant.id === current.dealerId) { const marked = payload.marked === true && hasMarkedCards(entryActor); const socialCheat = payload.socialCheat === true; const cheating = marked || socialCheat; const dealerHandCardIds = socialCheat ? payload.dealerHandCardIds ?? [] : []; if (socialCheat && dealerHandCardIds.length !== Math.max(0, 5 - entrant.hand.length)) throw new Error("Choose every card needed to complete the Dealer’s hand when cheating."); next = dealGolem(current, { markedCardIds: marked ? payload.markedCardIds ?? [] : [], dealerHandCardIds }); if (marked) next.cheatingDealerId = entrant.id; await markedCardCheck(next, entrant, cheating, payload.concealment === "deception" ? "deception" : "performance"); }
    else if (request.action === "tg-player-golem-match" && current.betting?.turnSeat === entrant.seat) next = golemBet(current, entrant.id, current.betting.currentBet ? "match" : "pass").state;
    else if (request.action === "tg-player-golem-fold" && current.betting?.turnSeat === entrant.seat) next = golemBet(current, entrant.id, "fold").state;
    else if (request.action === "tg-player-golem-raise" && current.betting?.turnSeat === entrant.seat) next = golemBet(current, entrant.id, current.betting.currentBet ? "raise" : "bet", payload.totalCp).state;
    else if (request.action === "tg-player-golem-discard") next = golemDiscard(current, entrant.id, payload.cardIds ?? []);
    else if (request.action === "tg-player-golem-discard-none") next = golemDiscard(current, entrant.id, []);
    else if (request.action === "tg-player-bounder-first" && entrant.id === current.shooterId) next = bounderFirstRoll(current, diceResult(entryActor, payload.result, 20));
    else if (request.action === "tg-player-bounder-second" && entrant.id === current.shooterId) next = bounderSecondRoll(current, diceResult(entryActor, payload.result, 20));
    else if (request.action === "tg-player-bounder-bet") next = bounderPlaceBet(current, { playerId: entrant.id, kind: payload.kind, amountCp: payload.amountCp });
    else if (request.action === "tg-player-bounder-double" && entrant.id === current.shooterId) next = bounderDoubleStake(current);
    else if (request.action === "tg-player-century-select") next = centuryChooseNumbers(current, entrant.id, payload.numbers, payload.stakeCp);
    else if (request.action === "tg-player-century-draw" && entrant.id === current.dealerId) next = centuryDraw(current, hasLoadedDice(entryActor) && payload.numbers?.length ? payload.numbers : null);
    else if (request.action === "tg-player-drink-ready") { next = setDrinkingReady(current, entrant.id, true); next.drinkingCheats ??= {}; next.drinkingCheats[entrant.id] = { cheated: payload.cheat === true, concealment: payload.concealment === "deception" ? "deception" : "performance" }; if (next.phase === "drinking-resolve") next = await resolveDrinks(next); }
    else if (request.action === "tg-player-arm-wrestling-ready") next = setArmWrestlingReady(current, entrant.id, true);
    else if (request.action === "tg-player-slapping-roll") {
      if (current.game !== TAVERN_GAME_IDS.SLAPPING || current.phase !== "slapping-round") throw new Error("Slapping is not waiting for a check.");
      if (entryActor.type !== "character") throw new Error("NPC Slapping checks are rolled automatically by the GM.");
      const expectedRole = entrant.id === current.strikerId ? "striker" : entrant.id === current.receiverId ? "receiver" : null;
      if (payload.role !== expectedRole) throw new Error("That role is no longer active for this Slapping round.");
      if (current.slappingRolls?.[entrant.id]) throw new Error("This competitor has already submitted a Slapping check.");
      const total = Number(payload.total);
      const natural = Number(payload.natural);
      if (!Number.isFinite(total) || !Number.isInteger(natural) || natural < 1 || natural > 20) throw new Error("The submitted Slapping result was invalid.");
      next = { ...current, slappingRolls: { ...(current.slappingRolls ?? {}), [entrant.id]: { role: expectedRole, total, natural, source: "owner" } } };
      if (next.players.filter((entry) => qualified(next, entry)).every((entry) => next.slappingRolls?.[entry.id])) next = await resolveSlapping(next);
    }
    else if (request.action === "tg-player-arm-wrestling-roll") {
      if (current.game !== TAVERN_GAME_IDS.ARM_WRESTLING || current.phase !== "arm-wrestling-resolve") throw new Error("Arm Wrestling is not waiting for Athletics checks.");
      if (entryActor.type !== "character") throw new Error("NPC Athletics checks are rolled automatically by the GM.");
      if (current.armWrestlingRolls?.[entrant.id]) throw new Error("This wrestler has already submitted an Athletics check.");
      const total = Number(payload.total);
      const natural = Number(payload.natural);
      if (!Number.isFinite(total) || !Number.isInteger(natural) || natural < 1 || natural > 20) throw new Error("The submitted Athletics result was invalid.");
      next = { ...current, armWrestlingRolls: { ...(current.armWrestlingRolls ?? {}), [entrant.id]: { total, natural, source: "owner" } } };
      if (next.players.filter((entry) => qualified(next, entry)).every((entry) => next.armWrestlingRolls?.[entry.id])) next = await resolveArmWrestling(next);
    }
    else throw new Error("That player action is not legal at the current tavern-game phase.");
    await entryActor.unsetFlag(MODULE_ID, REQUEST_FLAG);
    await entryActor.setFlag(MODULE_ID, STATUS_FLAG, { kind: "accepted", message: "The GM accepted your action." });
    await saveGame(await settleCompetitiveBets(next.state ?? next));
  }).catch(async (error) => {
    await entryActor.setFlag(MODULE_ID, STATUS_FLAG, { kind: "error", message: error.message ?? "The GM could not accept that action." });
  });
}

function addTavernGamesSheetButton(app, buttons) {
  const entryActor = app?.actor ?? app?.document ?? null;
  if (!entryActor || !["character", "npc"].includes(entryActor.type)) return;
  if (!isGM() && !entryActor.isOwner) return;
  if (buttons.some((button) => button.class === "pf2e-tavern-games-sheet")) return;
  buttons.unshift({ class: "pf2e-tavern-games-sheet", icon: "fa-solid fa-dice", label: "PF2e Tavern Games", onclick: () => isGM() ? openTavernGames() : openTavernPlayer(entryActor) });
}

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, STATE_KEY, { name: "PF2e Tavern Games state", scope: "world", config: false, restricted: true, type: Object, default: null });
  game.settings.register(MODULE_ID, BOARD_KEY, { name: "PF2e Tavern Games public board", scope: "world", config: false, restricted: false, type: Object, default: null });
});

Hooks.once("ready", () => {
  const module = game.modules.get(MODULE_ID);
  if (module) module.api = Object.freeze({ ...(module.api ?? {}), openPoppys: module.api?.open, open: openTavernGames, openPlayer: openTavernPlayer, start: promptTavernGame, clear: closeTavernGame, summary: () => gameSummary(state()) });
  Hooks.on("getActorSheetHeaderButtons", addTavernGamesSheetButton);
  Hooks.on("getCharacterSheetPF2eHeaderButtons", addTavernGamesSheetButton);
  Hooks.on("getNPCSheetPF2eHeaderButtons", addTavernGamesSheetButton);
  Hooks.on("getSceneControlButtons", (controls) => {
    const token = findSceneControl(controls, "token");
    if (!token || token.tools.some((tool) => tool.name === "pf2e-tavern-games")) return;
    token.tools.push({ name: "pf2e-tavern-games", title: isGM() ? "PF2e Tavern Games" : "PF2e Tavern Games — Your Game", icon: "fa-solid fa-dice", button: true, visible: true, onClick: () => isGM() ? openTavernGames() : openTavernPlayer() });
  });
  Hooks.on("updateSetting", (setting) => {
    if (setting.key === `${MODULE_ID}.${STATE_KEY}` && gameApp?.rendered) gameApp.render({ force: true });
    if (setting.key === `${MODULE_ID}.${BOARD_KEY}` && playerApp?.rendered) playerApp.render({ force: true });
  });
  Hooks.on("updateActor", (entryActor, changed, _options, userId) => {
    const changes = changed.flags?.[MODULE_ID] ?? {};
    if (changes[REQUEST_FLAG]) processPlayerAction(entryActor, changes[REQUEST_FLAG], userId);
    if (playerApp?.rendered && entryActor.id === currentPlayerActor()?.id && (changes[VIEW_FLAG] !== undefined || changes[STATUS_FLAG] !== undefined)) playerApp.render({ force: true });
  });
});
