import assert from "node:assert/strict";
import { readdir, readFile, rm } from "node:fs/promises";
import { extractPack } from "@foundryvtt/foundryvtt-cli";

const source = "./packs/pf2e-tavern-games-journals";
const destination = "./build/inspected-pf2e-tavern-games-journals";
const journalNames = [
  "Poppy’s Prize — Rules Reference",
  "Golem — Rules Reference",
  "Bounder — Rules Reference",
  "Century — Rules Reference",
  "Drinking Contest — Rules Reference",
  "How to Use PF2e Tavern Games",
];

await rm(destination, { recursive: true, force: true });
await extractPack(source, destination, { yaml: false, recursive: true, clean: true });
const files = (await readdir(destination)).filter((name) => name.endsWith(".json")).sort();
assert.equal(files.length, journalNames.length, "The compiled JournalEntry pack should contain exactly six documents.");
const journals = await Promise.all(files.map(async (file) => JSON.parse(await readFile(`${destination}/${file}`, "utf8"))));
const byName = new Map(journals.map((journal) => [journal.name, journal]));
assert.equal(byName.size, journalNames.length, "Every compiled JournalEntry must have a distinct display name.");
for (const name of journalNames) {
  const journal = byName.get(name);
  assert.ok(journal, `Missing JournalEntry: ${name}`);
  assert.equal(journal.pages?.length, 1, `${name} should have one text page.`);
  assert.equal(journal.pages[0].type, "text", `${name} should use a text page.`);
  assert.match(journal.pages[0].text?.content ?? "", /Created by Tatsu_Gamer using Manus AI/, `${name} should include the creator credit.`);
}
for (const name of journalNames.filter((name) => name !== "Drinking Contest — Rules Reference")) {
  assert.match(byName.get(name).pages[0].text?.content ?? "", /Jewel of the Indigo Isles|Pathfinder #159: All or Nothing/, `${name} should acknowledge its source.`);
}
const guide = byName.get("How to Use PF2e Tavern Games");
assert.match(guide.pages[0].text.content, /@UUID\[Compendium\.pf2e\.equipment-srd\.Item\.Q4KkKGGXq4bNGHh2\]\{Marked Playing Cards\}/, "The guide should include the requested Marked Playing Cards link.");
assert.match(guide.pages[0].text.content, /@UUID\[Compendium\.pf2e\.equipment-srd\.Item\.Q4KkKGGXq4bNGHh2\]\{Loaded Dice\}/, "The guide should include the requested Loaded Dice link.");
console.log("PF2e Tavern Games JournalEntry compendium pack validation passed.");
