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

const CONDITION_SLUG_BY_UUID = Object.freeze({
  "Compendium.pf2e.conditionitems.Item.i3OJZU2nk64Df3xm": "clumsy",
  "Compendium.pf2e.conditionitems.Item.AJh5ex99aV6VTggg": "off-guard",
  "Compendium.pf2e.conditionitems.Item.fesd1n5eVhpCSS18": "sickened",
  "Compendium.pf2e.conditionitems.Item.e1XGnhKNSQIm5IXg": "stupefied",
  "Compendium.pf2e.conditionitems.Item.fBnFDH2MTzgFijKf": "unconscious",
});

function createActor() {
  const records = new Map();
  const flags = new Map();
  let nextId = 1;

  const createItem = ({ id = `item-${nextId++}`, slug, type, value = null, active = true, source = {}, linkedItemIds = [] }) => {
    const item = {
      id,
      slug,
      type,
      active,
      name: source.name ?? slug,
      img: source.img,
      source: structuredClone(source),
      linkedItemIds,
      system: structuredClone(source.system ?? { value: { value } }),
      async update(changes) {
        if (Object.hasOwn(changes, "system.value.value")) this.system.value ??= {}, this.system.value.value = changes["system.value.value"];
      },
      async delete() {
        for (const linkedId of this.linkedItemIds) records.delete(linkedId);
        records.delete(this.id);
      },
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
    createEmbeddedDocuments: async (_documentType, sources) => sources.map((source) => {
      const effect = createItem({ slug: source.system.slug, type: source.type, source, linkedItemIds: [] });
      for (const rule of source.system.rules ?? []) {
        if (rule.key !== "GrantItem") continue;
        const slug = CONDITION_SLUG_BY_UUID[rule.uuid];
        assert.ok(slug, `GrantItem UUID ${rule.uuid} should map to a canonical PF2E condition.`);
        const value = rule.alterations?.find((alteration) => alteration.property === "badge-value")?.value ?? null;
        const condition = createItem({ slug, type: "condition", value, source: { system: { value: { value }, slug }, flags: { pf2e: { grantedBy: { id: effect.id, onDelete: rule.onDeleteActions?.granter } } } } });
        effect.linkedItemIds.push(condition.id);
      }
      return effect;
    }),
    addPersistentCondition: (slug, value) => createItem({ slug, type: "condition", value, source: { system: { value: { value } } } }),
    condition: (slug) => [...records.values()].find((item) => item.type === "condition" && item.slug === slug),
    conditions: (slug) => [...records.values()].filter((item) => item.type === "condition" && item.slug === slug),
    effects: () => [...records.values()].filter((item) => item.type === "effect"),
    has: (id) => records.has(id),
  };
}

const actor = createActor();
const persistentClumsy = actor.addPersistentCondition("clumsy", 3);
const effectIcon = "modules/pf2e-tavern-games/assets/icons/drinking-contest-effect.png";

await applyDrinkingStage(actor, 1);
assert.equal(actor.effects().length, 1, "Stage 1 creates one module-owned timed effect");
assert.equal(actor.effects()[0].img, effectIcon, "Every Drinking Contest effect uses the module-provided tankard icon");
assert.equal(actor.effects()[0].system.duration.value, 10, "Stage 1 effect lasts ten minutes");
assert.equal(actor.effects()[0].system.rules[0].key, "FlatModifier", "Stage 1 applies the fear-save bonus rule");
assert.equal(actor.effects()[0].system.rules[0].value, 1, "Stage 1 fear-save bonus is +1");
assert.equal(actor.itemTypes.condition.length, 1, "Stage 1 does not add a condition");

await applyDrinkingStage(actor, 2);
assert.equal(actor.effects().length, 1, "Changing stages replaces the former module-owned effect");
assert.ok(actor.condition("off-guard"), "Stage 2 grants off-guard from the parent effect");
const stageTwoGrant = actor.effects()[0].system.rules.find((rule) => rule.key === "GrantItem");
assert.deepEqual(stageTwoGrant.onDeleteActions, { granter: "cascade", grantee: "detach" }, "Each granted condition must cascade-delete when its parent effect is removed");
assert.equal(actor.effects()[0].system.rules[0].value, 1, "Stage 2 retains the fear-save bonus");
const stageTwoEffect = actor.effects()[0];
await stageTwoEffect.delete();
assert.equal(actor.condition("off-guard"), undefined, "Deleting the parent effect removes its linked off-guard condition");

await applyDrinkingStage(actor, 3);
assert.ok(actor.condition("off-guard"), "Stage 3 grants off-guard from the parent effect");
assert.equal(actor.condition("clumsy").system.value.value, 3, "A stronger pre-existing clumsy condition is never reduced");
assert.equal(actor.conditions("clumsy").length, 2, "Stage 3 grants its own linked clumsy condition without modifying the stronger pre-existing one");
assert.equal(actor.condition("stupefied").system.value.value, 2, "Stage 3 grants stupefied 2");
assert.equal(actor.effects()[0].system.rules.length, 3, "Stage 3 has a parent GrantItem rule for each required condition");
assert.ok(actor.effects()[0].system.rules.every((rule) => rule.key === "GrantItem"), "Stage 3's effect owns all its temporary conditions through GrantItem rules");

await applyDrinkingStage(actor, 4);
assert.equal(actor.condition("clumsy").system.value.value, 3, "Stage 4 still preserves the stronger pre-existing clumsy condition");
assert.equal(actor.condition("sickened").system.value.value, 2, "Stage 4 grants sickened 2");
assert.equal(actor.condition("off-guard"), undefined, "Stage 4 removes the prior effect's linked off-guard condition");
assert.equal(actor.condition("stupefied"), undefined, "Stage 4 removes the prior effect's linked stupefied condition");

await applyDrinkingStage(actor, 5);
assert.equal(actor.condition("sickened").system.value.value, 2, "Stage 5 keeps sickened 2");
assert.equal(actor.condition("stupefied").system.value.value, 2, "Stage 5 grants stupefied 2");

await applyDrinkingStage(actor, 6);
assert.ok(actor.condition("unconscious"), "Stage 6 grants unconscious from the parent effect");
assert.equal(actor.effects()[0].system.duration.value, 8, "Stage 6 effect is recorded for eight hours");
assert.equal(actor.effects()[0].system.duration.unit, "hours", "Stage 6 effect uses hours");
assert.equal(actor.condition("sickened"), undefined, "Stage 6 removes the preceding effect's linked sickened condition");

await clearDrinkingEffects(actor);
assert.equal(actor.effects().length, 0, "Closing or clearing the contest removes the parent effect");
assert.equal(actor.condition("unconscious"), undefined, "Clearing the parent effect cascade-removes unconscious");
assert.ok(actor.has(persistentClumsy.id), "Clearing never removes a pre-existing condition");
assert.equal(actor.condition("clumsy").system.value.value, 3, "Clearing preserves the pre-existing condition value unchanged");

console.log("Drinking Contest stage condition integration tests passed.");
