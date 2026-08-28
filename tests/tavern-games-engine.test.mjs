import assert from "node:assert/strict";
import {
  TAVERN_GAME_IDS,
  CENTURY_PAYOUTS,
  DRINKING_STAGES,
  createGolemGame,
  dealGolem,
  golemBet,
  golemDiscard,
  createBounderGame,
  bounderFirstRoll,
  bounderPlaceBet,
  bounderDealerRoll,
  bounderSecondRoll,
  createCenturyGame,
  centuryChooseNumbers,
  centuryDraw,
  createDrinkingGame,
  setDrinkingReady,
  resolveDrinkingRound,
  disqualifyTavernPlayer,
  loadedDiceEligible,
  markedCardsEligible,
} from "../scripts/tavern-games-engine.mjs";

const participants = [
  { id: "a", actorId: "a", name: "Aster" },
  { id: "b", actorId: "b", name: "Beryl" },
  { id: "c", actorId: "c", name: "Cato" },
  { id: "d", actorId: "d", name: "Dara" },
];
const rng = () => 0.37;

// Golem: 52 cards, five cards per entrant, ante, and a player-controlled first betting round.
let golem = createGolemGame({ participants: participants.slice(0, 3), dealerId: "a", anteCp: 20, rng });
assert.equal(golem.game, TAVERN_GAME_IDS.GOLEM);
assert.equal(golem.deck.length, 52);
assert.equal(golem.amuletSeat, 2, "The player to the dealer’s right should hold the initial amulet.");
golem = dealGolem(golem, { markedCardIds: [golem.deck[0].id, golem.deck[1].id] });
assert.equal(golem.phase, "golem-betting-1");
assert.equal(golem.deck.length, 37);
assert.equal(golem.potCp, 60);
assert.equal(golem.players.find((entry) => entry.id === "a").hand.length, 5);
assert.equal(golem.cheatingDealerId, "a");
for (const id of ["b", "c", "a"]) golem = golemBet(golem, id, "pass").state;
assert.equal(golem.phase, "golem-discard");
for (const id of ["a", "b", "c"]) golem = golemDiscard(golem, id, []);
assert.equal(golem.phase, "golem-betting-2");
assert.throws(() => dealGolem(golem), /not ready to deal/i, "A hand cannot be dealt during betting.");

// Bounder: point, dealer result, bounding result, point bet, and payout.
let bounder = createBounderGame({ participants: participants.slice(0, 3), shooterId: "a", stakeCp: 10 });
bounder = bounderFirstRoll(bounder, 8);
bounder = bounderPlaceBet(bounder, { playerId: "b", kind: "point", amountCp: 7 });
bounder = bounderPlaceBet(bounder, { playerId: "c", kind: "even", amountCp: 3 });
bounder = bounderDealerRoll(bounder, [3, 3, 4]);
assert.equal(bounder.dealerTotal, 10);
assert.equal(bounder.phase, "bounder-second-roll");
bounder = bounderSecondRoll(bounder, 18);
assert.equal(bounder.phase, "bounder-complete");
assert.equal(bounder.result.bounded, true);
assert.equal(bounder.result.payouts.find((entry) => entry.playerId === "a").amountCp, 20);
assert.equal(bounder.result.payouts.find((entry) => entry.playerId === "b").amountCp, 14);
assert.equal(bounder.result.payouts.find((entry) => entry.playerId === "c"), undefined);

// Century: 2–10 unique predictions, twenty unique results, and official multiplier lookup.
let century = createCenturyGame({ participants: participants.slice(0, 2), dealerId: "a", minimumStakeCp: 5 });
century = centuryChooseNumbers(century, "a", [1, 10], 10);
century = centuryChooseNumbers(century, "b", [2, 3, 4], 5);
assert.equal(century.phase, "century-draw");
century = centuryDraw(century, [1, 10, 2, 3, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36]);
assert.equal(century.drawn.length, 20);
assert.equal(century.result.find((entry) => entry.playerId === "a").multiplier, CENTURY_PAYOUTS[2][2]);
assert.equal(century.result.find((entry) => entry.playerId === "a").payoutCp, 50);
assert.equal(century.result.find((entry) => entry.playerId === "b").multiplier, CENTURY_PAYOUTS[2][3]);
assert.throws(() => centuryDraw({ ...century, phase: "century-draw" }, Array(20).fill(1)), /twenty distinct/i);

// Drinking contest: readiness, all three degree adjustments, named stages, loss at Stage 6, and disqualification.
let drinks = createDrinkingGame({ participants: participants.slice(0, 3), fortitudeDC: 20 });
for (const id of ["a", "b", "c"]) drinks = setDrinkingReady(drinks, id);
assert.equal(drinks.phase, "drinking-resolve");
drinks = resolveDrinkingRound(drinks, [
  { playerId: "a", performanceTotal: 16, fortitudeTotal: 31, fortitudeDegree: "criticalSuccess" },
  { playerId: "b", performanceTotal: 10, fortitudeTotal: 19, fortitudeDegree: "failure" },
  { playerId: "c", performanceTotal: 2, fortitudeTotal: 8, fortitudeDegree: "criticalFailure" },
]);
assert.equal(drinks.players.find((entry) => entry.id === "a").stage, 0);
assert.equal(drinks.players.find((entry) => entry.id === "b").stage, 1);
assert.equal(drinks.players.find((entry) => entry.id === "c").stage, 2);
assert.equal(DRINKING_STAGES[5].name, "Blackout Bound");
let finalDrink = { ...drinks, phase: "drinking-resolve", players: drinks.players.map((entry) => ({ ...entry, ready: true, stage: entry.id === "a" ? 5 : entry.stage })) };
finalDrink = resolveDrinkingRound(finalDrink, [
  { playerId: "a", fortitudeDegree: "failure" },
  { playerId: "b", fortitudeDegree: "success" },
  { playerId: "c", fortitudeDegree: "success" },
]);
assert.equal(finalDrink.players.find((entry) => entry.id === "a").stage, 6);
assert.equal(finalDrink.players.find((entry) => entry.id === "a").out, true);
const disqualified = disqualifyTavernPlayer(finalDrink, "b", "Caught cheating");
assert.equal(disqualified.players.find((entry) => entry.id === "b").disqualified, true);
assert.equal(disqualified.disqualifications[0].reason, "Caught cheating");

assert.equal(loadedDiceEligible({ items: [{ slug: "games-loaded-dice" }] }), true);
assert.equal(markedCardsEligible({ items: [{ system: { slug: "marked-playing-cards" } }] }), true);
assert.equal(loadedDiceEligible({ items: [] }), false);

console.log("PF2e Tavern Games multi-game engine tests passed.");
