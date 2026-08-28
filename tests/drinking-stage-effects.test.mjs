import assert from "node:assert/strict";

// Minimal Foundry globals required to load the controller without starting applications or hooks.
globalThis.Hooks = { once: () => {}, on: () => {} };
globalThis.foundry = {
  applications: { api: { ApplicationV2: class {}, DialogV2: class {} } },
  utils: { randomID: () => "test-request" },
};
globalThis.game = {
  time: { worldTime: 123456 },
  users: [],
  user: { isGM: true },
  actors: { get: () => null, filter: () => [], party: null },
  settings: { get: () => null, set: async () => {} },
};

const { applyDrinkingStage, clearDrinkingEffects } = await import("../scripts/tavern-games.mjs");

function createActor() {
  const records = new Map();
  const flags = new Map();
  let nextId = 1;

  const createItem = ({ id = `item-${nextId++}`, slug, type, value = null, active = true, source = {} }) => {
    const item = {
      id,
      slug,
      type,
      active,
      name: source.name ?? slug,
      system: structuredClone(source.system ?? { value: { value } }),
      async update(changes) {
        if (Object.hasOwn(changes, "system.value.value")) this.system.value ??= {}, this.system.value.value = changes["system.value.value"];
      },
      async delete() { records.delete(this.id); },
    };
    records.set(item.id, item);
    return item;
  };

  return {
    items: { get: (id) => records.get(id) },
    get itemTypes() { return { condition: [...records.values()].filter((item) => item.type === "condition") }; },
    getFlag: (scope, key) => flags.get(`${scope}.${key}`),
    setFlag: async (scope, key, value) => { flags.set(`${scope}.${key}`, structuredClone(value)); },
    unsetFlag: async (scope, key) => { flags.delete(`${scope}.${key}`); },
    increaseCondition: async (slug, { value } = {}) => createItem({ slug, type: "condition", value: value ?? null }),
    createEmbeddedDocuments: async (_documentType, sources) => sources.map((source) => createItem({ slug: source.system.slug, type: source.type, source })),
    addPersistentCondition: (slug, value) => createItem({ slug, type: "condition", value, source: { system: { value: { value } } } }),
    condition: (slug) => [...records.values()].find((item) => item.type === "condition" && item.slug === slug),
    effects: () => [...records.values()].filter((item) => item.type === "effect"),
    has: (id) => records.has(id),
  };
}

const actor = createActor();
const persistentClumsy = actor.addPersistentCondition("clumsy", 3);

await applyDrinkingStage(actor, 1);
assert.equal(actor.effects().length, 1, "Stage 1 creates one module-owned timed effect");
assert.equal(actor.effects()[0].system.duration.value, 10, "Stage 1 effect lasts ten minutes");
assert.equal(actor.effects()[0].system.rules[0].key, "FlatModifier", "Stage 1 applies the fear-save bonus rule");
assert.equal(actor.effects()[0].system.rules[0].value, 1, "Stage 1 fear-save bonus is +1");
assert.equal(actor.itemTypes.condition.length, 1, "Stage 1 does not add a condition");

await applyDrinkingStage(actor, 2);
assert.equal(actor.effects().length, 1, "Changing stages replaces the former module-owned effect");
assert.ok(actor.condition("off-guard"), "Stage 2 applies off-guard");
assert.equal(actor.effects()[0].system.rules[0].value, 1, "Stage 2 retains the fear-save bonus");

await applyDrinkingStage(actor, 3);
assert.ok(actor.condition("off-guard"), "Stage 3 retains off-guard");
assert.equal(actor.condition("clumsy").system.value.value, 3, "A stronger pre-existing clumsy condition is never reduced");
assert.equal(actor.condition("stupefied").system.value.value, 2, "Stage 3 applies stupefied 2");
assert.equal(actor.effects()[0].system.rules.length, 0, "Stage 3 has no remaining fear-save bonus");

await applyDrinkingStage(actor, 4);
assert.equal(actor.condition("clumsy").system.value.value, 3, "Stage 4 still preserves the stronger pre-existing clumsy condition");
assert.equal(actor.condition("sickened").system.value.value, 2, "Stage 4 applies sickened 2");
assert.equal(actor.condition("off-guard"), undefined, "Stage 4 removes module-created off-guard from the prior stage");
assert.equal(actor.condition("stupefied"), undefined, "Stage 4 removes module-created stupefied from the prior stage");

await applyDrinkingStage(actor, 5);
assert.equal(actor.condition("sickened").system.value.value, 2, "Stage 5 keeps sickened 2");
assert.equal(actor.condition("stupefied").system.value.value, 2, "Stage 5 applies stupefied 2");

await applyDrinkingStage(actor, 6);
assert.ok(actor.condition("unconscious"), "Stage 6 applies unconscious");
assert.equal(actor.effects()[0].system.duration.value, 8, "Stage 6 effect is recorded for eight hours");
assert.equal(actor.effects()[0].system.duration.unit, "hours", "Stage 6 effect uses hours");
assert.equal(actor.condition("sickened"), undefined, "Stage 6 clears the preceding module-created sickened condition");

await clearDrinkingEffects(actor);
assert.equal(actor.effects().length, 0, "Closing or clearing the contest removes module-owned effects");
assert.equal(actor.condition("unconscious"), undefined, "Clearing removes the module-created unconscious condition");
assert.ok(actor.has(persistentClumsy.id), "Clearing never removes a pre-existing condition");
assert.equal(actor.condition("clumsy").system.value.value, 3, "Clearing restores the pre-existing condition value unchanged");

console.log("Drinking Contest stage condition integration tests passed.");
