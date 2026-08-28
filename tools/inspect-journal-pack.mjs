import assert from "node:assert/strict";
import { readdir, readFile, rm } from "node:fs/promises";
import { extractPack } from "@foundryvtt/foundryvtt-cli";

const source = "./packs/pf2e-tavern-games-journals";
const destination = "./build/inspected-pf2e-tavern-games-journals";

await rm(destination, { recursive: true, force: true });
await extractPack(source, destination, { yaml: false, recursive: true, clean: true });
const files = (await readdir(destination)).filter((name) => name.endsWith(".json")).sort();
assert.equal(files.length, 2, "The compiled JournalEntry pack should contain exactly two documents.");
const journals = await Promise.all(files.map(async (file) => JSON.parse(await readFile(`${destination}/${file}`, "utf8"))));
const byName = new Map(journals.map((journal) => [journal.name, journal]));
for (const name of ["Poppy’s Prize — Rules Reference", "How to Use PF2e Tavern Games"]) {
  const journal = byName.get(name);
  assert.ok(journal, `Missing JournalEntry: ${name}`);
  assert.equal(journal.pages?.length, 1, `${name} should have one text page.`);
  assert.equal(journal.pages[0].type, "text", `${name} should use a text page.`);
  assert.match(journal.pages[0].text?.content ?? "", /Created by Tatsu_Gamer using Manus AI/, `${name} should include the creator credit.`);
  assert.match(journal.pages[0].text?.content ?? "", /Jewel of the Indigo Isles/, `${name} should acknowledge Poppy’s Prize’s source.`);
}
console.log("PF2e Tavern Games JournalEntry compendium pack validation passed.");
