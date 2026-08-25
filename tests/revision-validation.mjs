import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";

const moduleRoot = new URL("../", import.meta.url);
const mainSource = readFileSync(new URL("scripts/main.mjs", moduleRoot), "utf8");
const cssSource = readFileSync(new URL("styles/poppys-prize.css", moduleRoot), "utf8");
const manifest = JSON.parse(readFileSync(new URL("module.json", moduleRoot), "utf8"));
const cardDirectory = new URL("assets/cards/", moduleRoot);
const cards = readdirSync(cardDirectory).filter((name) => name.endsWith(".webp"));

assert.equal(manifest.version, "1.1.0", "The release version should be 1.1.0");
assert.match(mainSource, /\["character", "npc"\]\.includes\(actor\.type\)/, "The player selector should admit PC and NPC actors");
assert.match(mainSource, /assets\/cards\/card_back\.webp/, "The supplied card back should render for concealed cards");
assert.match(mainSource, /cardAssetPath\(card\)/, "The supplied card faces should render from module assets");
assert.equal(cards.length, 55, "The module should include 52 suit cards, two Pirates, and a card back");
for (const name of ["card_back.webp", "ships_01.webp", "gems_king.webp", "parrots_queen.webp", "trees_jack.webp", "pirate_1.webp", "pirate_2.webp"]) {
  assert.ok(existsSync(new URL(name, cardDirectory)), `Missing required deck asset: ${name}`);
}
assert.doesNotMatch(cssSource, /centre/, "The stylesheet should use CSS-compatible alignment keywords");

console.log("Poppy’s Prize 1.1.0 revision validation passed.");
