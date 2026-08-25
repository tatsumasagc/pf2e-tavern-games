import { rm } from "node:fs/promises";
import { compilePack } from "@foundryvtt/foundryvtt-cli";

const source = "./src/packs/poppys-prize-macros";
const destination = "./packs/poppys-prize-macros";

await rm(destination, { recursive: true, force: true });
await compilePack(source, destination, { yaml: false, recursive: true });
console.log(`Compiled ${source} to ${destination}`);
