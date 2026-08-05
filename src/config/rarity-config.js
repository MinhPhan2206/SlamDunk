export const rarityDefinitions = Object.freeze([
  Object.freeze({ rarityCode: "BASE", name: "Base", rank: 1 }),
  Object.freeze({ rarityCode: "COMMON", name: "Common", rank: 2 }),
  Object.freeze({ rarityCode: "UNCOMMON", name: "Uncommon", rank: 3 }),
  Object.freeze({ rarityCode: "ALPHA", name: "Alpha", rank: 4 }),
  Object.freeze({ rarityCode: "ALL_STAR", name: "All-Star", rank: 5 }),
  Object.freeze({ rarityCode: "SUPERSTAR", name: "Superstar", rank: 6 }),
  Object.freeze({ rarityCode: "GOAT", name: "Goat", rank: 7 }),
]);

const definitionsByCode = new Map(
  rarityDefinitions.map((definition) => [definition.rarityCode, definition]),
);

export function getRarityDefinition(rarityCode) {
  const definition = definitionsByCode.get(rarityCode);
  if (!definition) {
    throw new RangeError("rarityCode is not configured.");
  }
  return definition;
}

export function formatRarity(rarityCode) {
  return getRarityDefinition(rarityCode).name;
}
