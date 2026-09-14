import assert from "node:assert/strict";
import { findSceneControl } from "../scripts/scene-controls.mjs";

const token = { name: "token", tools: [] };
const tiles = { name: "tiles", tools: [] };

assert.equal(findSceneControl([tiles, token], "token"), token, "Legacy array controls should be supported.");
assert.equal(findSceneControl({ token, tiles }, "token"), token, "Foundry v14 keyed controls should be supported.");
assert.equal(findSceneControl(new Map([["token", token], ["tiles", tiles]]), "token"), token, "Map-like controls should be supported.");
assert.equal(findSceneControl({ token, tiles }, "lights"), undefined, "Unknown controls should return undefined.");
assert.equal(findSceneControl(null, "token"), undefined, "Missing controls should return undefined.");

console.log("Scene control compatibility tests passed.");
