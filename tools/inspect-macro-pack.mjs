import assert from "node:assert/strict";
import { readdir, readFile, rm } from "node:fs/promises";
import { extractPack } from "@foundryvtt/foundryvtt-cli";

const source = "./packs/pf2e-tavern-games-macros";
const destination = "./build/inspected-pf2e-tavern-games-macros";

await rm(destination, { recursive: true, force: true });
await extractPack(source, destination, { yaml: false, recursive: true, clean: true });
const files = (await readdir(destination)).filter((name) => name.endsWith(".json"));
assert.equal(files.length, 1, "The compiled Macro pack should contain exactly one document.");
const macro = JSON.parse(await readFile(`${destination}/${files[0]}`, "utf8"));
assert.equal(macro._key, "!macros!PPPrizeLaunch001", "The compiled document should retain its Macro compendium key.");
assert.equal(macro.name, "Open PF2e Tavern Games", "The compiled Macro pack should contain the PF2e Tavern Games library launch macro.");
assert.equal(macro.type, "script", "The compiled compendium document should be a script Macro.");
assert.equal(macro.img, "modules/pf2e-tavern-games/assets/icons/poppys-prize-macro.webp", "The compiled macro should use the supplied icon from the new package path.");
assert.match(macro.command, /game\.modules\.get\("pf2e-tavern-games"\)/, "The compiled macro should launch the PF2e Tavern Games module.");
console.log("PF2e Tavern Games Macro compendium pack validation passed.");
