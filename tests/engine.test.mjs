import assert from "node:assert/strict";
import {
  PHASES,
  bestPokerHand,
  bettingAction,
  chooseKeep,
  coinsToCopper,
  createDeck,
  createGame,
  dealNextGame,
  dealPreparedGame,
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
assert.equal(coinsToCopper({ pp: 1, gp: 2, sp: 3, cp: 4 }), 1234, "Separate coin inputs should convert to copper correctly");

const participants = [
  { id: "a", actorId: "actor-a", name: "Ari" },
  { id: "b", actorId: "actor-b", name: "Bea" },
  { id: "c", actorId: "actor-c", name: "Cor" },
  { id: "d", actorId: "actor-d", name: "Dee" },
];
let state = createGame({ participants, anteCp: 500, dealerId: "b", rng: () => 0.42 });
assert.equal(state.potCp, 0, "Antes are not collected until Poppy deals");
assert.equal(state.phase, PHASES.DEAL, "The table waits for Poppy to deal");
assert.equal(state.players.find((player) => player.seat === state.dealerSeat).id, "b", "The selected deck owner is the first Poppy");
assert.ok(state.players.every((player) => player.hand.length === 0), "No private hands exist before Poppy deals");
const markedCardIds = state.deck.slice(0, 2).map((card) => card.id);
state = dealPreparedGame(state, { markedCardIds, rng: () => 0.42 });
assert.equal(state.potCp, 2000, "All players ante when Poppy deals");
assert.equal(state.phase, PHASES.SELECT_COMMON, "Dealing begins the common-card phase");
assert.ok(markedCardIds.every((id) => state.players.find((player) => player.id === "b").hand.some((card) => card.id === id)), "Poppy receives the two selected marked cards");
assert.equal(state.cheatingDealerId, "b", "Only the dealer who used marked cards is recorded as cheating");
assert.equal(state.common.length, 0, "Four real players need no dummy common cards");

const socialState = createGame({ participants, anteCp: 500, dealerId: "b", rng: () => 0.42 });
const selectedHand = socialState.deck.slice(0, 5).map((card) => card.id);
const sociallyCheated = dealPreparedGame(socialState, { dealerHandCardIds: selectedHand, rng: () => 0.42 });
assert.ok(selectedHand.every((id) => sociallyCheated.players.find((player) => player.id === "b").hand.some((card) => card.id === id)), "A cheating Poppy may choose every card in their hand");
assert.equal(sociallyCheated.cheatingDealerId, null, "Social cheating does not grant marked-card sight");

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
assert.equal(state.phase, PHASES.DEAL, "A completed round prepares the next game for the new Poppy");
assert.equal(state.gameNumber, 2);
assert.equal(state.potCp, 0, "The next ante is not collected until Poppy deals");
const laterGamePoppy = state.players.find((player) => player.seat === state.dealerSeat);
const sightState = dealPreparedGame(structuredClone(state), { markedCardSight: true, rng: () => 0.42 });
assert.equal(sightState.cheatingDealerId, laterGamePoppy.id, "An eligible later-game Poppy can use marked-card sight");
assert.throws(() => dealPreparedGame(structuredClone(state), { markedCardIds: state.deck.slice(0, 2).map((card) => card.id), rng: () => 0.42 }), /only for the first game/, "Later-game Poppies cannot choose opening cards with marked cards");
state = dealPreparedGame(state, { rng: () => 0.42 });
assert.equal(state.cheatingDealerId, null, "Marked-card sight remains off when a later-game Poppy does not elect to use marked cards");
assert.equal(state.phase, PHASES.SELECT_COMMON, "The next game begins only when Poppy uses Deal cards");
assert.equal(state.potCp, 2000, "The next game collects a fresh ante when Poppy deals");
assert.ok(state.players.every((player) => player.hand.length === 5), "Each player begins the next game with five cards");

console.log("Poppy’s Prize engine tests passed.");
