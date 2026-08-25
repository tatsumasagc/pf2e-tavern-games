import assert from "node:assert/strict";
import {
  PHASES,
  bestPokerHand,
  bettingAction,
  chooseKeep,
  createDeck,
  createGame,
  dealNextGame,
  declinePlunder,
  getCurrentActor,
  selectCommon,
} from "../scripts/engine.mjs";

const deck = createDeck();
const by = (rank, suit) => deck.find((card) => card.rank === rank && card.suit === suit);

assert.equal(deck.length, 54, "Poppy’s Prize uses 54 cards");
assert.equal(deck.filter((card) => card.pirate).length, 2, "The deck contains two Pirates");
assert.equal(by("A", "ships").image, "assets/cards/ships_01.webp", "Aces map to the supplied 01 card art");
assert.equal(deck.find((card) => card.id === "c-53").image, "assets/cards/pirate_1.webp", "The first Pirate uses the supplied Pirate art");
assert.ok(deck.every((card) => card.image?.startsWith("assets/cards/")), "Every logical card has a supplied image asset");
assert.equal(bestPokerHand([by("A", "ships"), by("K", "ships"), by("Q", "ships"), by("J", "ships"), by("10", "ships")]).name, "Straight Flush");
assert.equal(bestPokerHand([by("A", "trees"), by("A", "ships"), by("A", "gems"), by("A", "parrots"), by("10", "ships")]).name, "Four of a Kind");
assert.equal(bestPokerHand([by("A", "trees"), by("A", "ships"), by("K", "gems"), by("K", "parrots"), by("10", "ships")]).name, "Two Pair");
assert.equal(bestPokerHand([by("A", "trees"), by("2", "ships"), by("3", "gems"), by("4", "parrots"), by("5", "ships")]).name, "Straight");

const participants = [
  { id: "a", actorId: "actor-a", name: "Ari" },
  { id: "b", actorId: "actor-b", name: "Bea" },
  { id: "c", actorId: "actor-c", name: "Cor" },
  { id: "d", actorId: "actor-d", name: "Dee" },
];
let state = createGame({ participants, anteCp: 500, rng: () => 0.42 });
assert.equal(state.potCp, 2000, "All players ante at game start");
assert.equal(state.phase, PHASES.SELECT_COMMON);
assert.equal(state.common.length, 0, "Four real players need no dummy common cards");

for (const player of state.players) state = selectCommon(state, player.id, player.hand[0].id);
assert.equal(state.phase, PHASES.BETTING, "The dealer reveals a common card after all selections");
assert.equal(state.round, 1);

let guard = 100;
while (state.phase !== PHASES.KEEP && guard-- > 0) {
  if (state.phase === PHASES.BETTING) {
    const actor = getCurrentActor(state);
    const result = bettingAction(state, actor, "pass");
    state = result.state;
  } else if (state.phase === PHASES.PLUNDER) {
    state = declinePlunder(state, getCurrentActor(state));
  } else {
    assert.fail(`Unexpected state during passive game: ${state.phase}`);
  }
}
assert.ok(guard > 0, "The round progresses through all betting and Plunder phases");
assert.equal(state.phase, PHASES.KEEP, "Showdown moves to the keeping phase");
assert.equal(state.potCp, 0, "A single winning hand receives the full pot");
assert.equal(state.payouts.reduce((total, payout) => total + payout.copper, 0), 2000, "The pot payout is conserved");

for (const player of state.players) state = chooseKeep(state, player.id, null);
assert.equal(state.phase, PHASES.COMPLETE, "All players must explicitly complete their keeping choice");
state = dealNextGame(state, () => 0.42);
assert.equal(state.phase, PHASES.SELECT_COMMON, "A completed round can deal the next game");
assert.equal(state.gameNumber, 2);
assert.equal(state.potCp, 2000, "The next game collects a fresh ante from every player");
assert.ok(state.players.every((player) => player.hand.length === 5), "Each player begins the next game with five cards");

console.log("Poppy’s Prize engine tests passed.");
