import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";

const moduleRoot = new URL("../", import.meta.url);
const mainSource = readFileSync(new URL("scripts/main.mjs", moduleRoot), "utf8");
const cssSource = readFileSync(new URL("styles/poppys-prize.css", moduleRoot), "utf8");
const manifest = JSON.parse(readFileSync(new URL("module.json", moduleRoot), "utf8"));
const cardDirectory = new URL("assets/cards/", moduleRoot);
const icon = new URL("assets/icons/poppys-prize-macro.webp", moduleRoot);
const macroSource = new URL("src/packs/poppys-prize-macros/Macro_Open_Poppys_Prize_PPPrizeLaunch001.json", moduleRoot);
const macroPack = new URL("packs/poppys-prize-macros/", moduleRoot);
const cards = readdirSync(cardDirectory).filter((name) => name.endsWith(".webp"));

assert.equal(manifest.version, "1.2.0", "The release version should be 1.2.0");
assert.match(mainSource, /\["character", "npc"\]\.includes\(actor\.type\)/, "The player selector should admit PC and NPC actors");
assert.match(mainSource, /assets\/cards\/card_back\.webp/, "The supplied card back should render for concealed cards");
assert.match(mainSource, /cardAssetPath\(card\)/, "The supplied card faces should render from module assets");
assert.equal(cards.length, 55, "The module should include 52 suit cards, two Pirates, and a card back");
for (const name of ["card_back.webp", "ships_01.webp", "gems_king.webp", "parrots_queen.webp", "trees_jack.webp", "pirate_1.webp", "pirate_2.webp"]) {
  assert.ok(existsSync(new URL(name, cardDirectory)), `Missing required deck asset: ${name}`);
}
assert.doesNotMatch(cssSource, /centre/, "The stylesheet should use CSS-compatible alignment keywords");
assert.equal(manifest.packs?.[0]?.name, "poppys-prize-macros", "The Macro pack should be registered in the manifest");
assert.equal(manifest.packs?.[0]?.type, "Macro", "The registered compendium should contain Macro documents");
assert.equal(manifest.packFolders?.[0]?.name, "Poppy’s Prize", "The Macro pack should appear in the Poppy’s Prize compendium folder");
assert.ok(existsSync(icon), "The macro icon should be included");
assert.ok(existsSync(macroSource), "The tracked macro source should be included");
assert.ok(readdirSync(macroPack).some((name) => name.startsWith("MANIFEST-")), "The compiled LevelDB Macro pack should be included");
const macro = JSON.parse(readFileSync(macroSource, "utf8"));
assert.equal(macro.name, "Open Poppy’s Prize", "The compendium should provide the launch macro");
assert.equal(macro.img, "modules/poppys-prize/assets/icons/poppys-prize-macro.webp", "The macro should use the included square icon");
assert.match(macro.command, /game\.modules\.get\("poppys-prize"\)/, "The macro should open the Poppy’s Prize module");

console.log("Poppy’s Prize 1.2.0 revision validation passed.");
