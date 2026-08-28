import { rm } from "node:fs/promises";
import { compilePack } from "@foundryvtt/foundryvtt-cli";

const packs = [
  { source: "./src/packs/pf2e-tavern-games-macros", destination: "./packs/pf2e-tavern-games-macros" },
  { source: "./src/packs/pf2e-tavern-games-journals", destination: "./packs/pf2e-tavern-games-journals" },
];

for (const { source, destination } of packs) {
  await rm(destination, { recursive: true, force: true });
  await compilePack(source, destination, { yaml: false, recursive: true });
  console.log(`Compiled ${source} to ${destination}`);
}
