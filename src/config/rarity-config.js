export const rarityDefinitions = Object.freeze([
  Object.freeze({ rarityTier: 1, rarityCode: "BASE", name: "Base" }),
  Object.freeze({ rarityTier: 2, rarityCode: "COMMON", name: "Common" }),
  Object.freeze({ rarityTier: 3, rarityCode: "UNCOMMON", name: "Uncommon" }),
  Object.freeze({ rarityTier: 4, rarityCode: "ALPHA", name: "Alpha" }),
  Object.freeze({ rarityTier: 5, rarityCode: "ALL_STAR", name: "All-Star" }),
  Object.freeze({ rarityTier: 6, rarityCode: "SUPERSTAR", name: "Superstar" }),
  Object.freeze({ rarityTier: 7, rarityCode: "GOAT", name: "Goat" }),
]);

const definitionsByTier = new Map(
  rarityDefinitions.map((definition) => [definition.rarityTier, definition]),
);

export function getRarityDefinition(rarityTier) {
  const definition = definitionsByTier.get(rarityTier);
  if (!definition) {
    throw new RangeError("rarityTier must be an integer from 1 through 7.");
  }
  return definition;
}

export function formatRarity(rarityTier) {
  const definition = getRarityDefinition(rarityTier);
  return `${definition.name} (Tier ${definition.rarityTier})`;
}
