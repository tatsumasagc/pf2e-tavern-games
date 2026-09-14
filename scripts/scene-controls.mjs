/**
 * Find a named Scene Control across Foundry versions.
 * Foundry v14 supplies a keyed control object, while older versions supplied an array.
 * Collection- and Map-like values are accepted as an additional compatibility guard.
 */
export function findSceneControl(controls, name) {
  if (!controls) return undefined;
  if (Array.isArray(controls)) return controls.find((control) => control?.name === name);
  if (typeof controls.get === "function") {
    const direct = controls.get(name);
    if (direct) return direct;
    if (typeof controls.values === "function") return [...controls.values()].find((control) => control?.name === name);
  }
  if (typeof controls.values === "function") return [...controls.values()].find((control) => control?.name === name);
  return Object.values(controls).find((control) => control?.name === name);
}
