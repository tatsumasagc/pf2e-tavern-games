import { rm } from "node:fs/promises";
import { compilePack } from "@foundryvtt/foundryvtt-cli";

const packs = [
  { source: "./src/packs/poppys-prize-macros", destination: "./packs/poppys-prize-macros" },
  { source: "./src/packs/poppys-prize-journals", destination: "./packs/poppys-prize-journals" },
];

for (const { source, destination } of packs) {
  await rm(destination, { recursive: true, force: true });
  await compilePack(source, destination, { yaml: false, recursive: true });
  console.log(`Compiled ${source} to ${destination}`);
}
