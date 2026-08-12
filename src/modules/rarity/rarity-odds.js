import { getRarityDefinition } from "../../config/rarity-config.js";

export function buildRarityOdds(rarityWeights) {
  if (!Array.isArray(rarityWeights) || rarityWeights.length === 0) {
    throw new TypeError("rarityWeights must contain at least one rarity.");
  }
  const seen = new Set();
  let totalWeight = 0;
  for (const entry of rarityWeights) {
    if (
      typeof entry.rarityCode !== "string" ||
      seen.has(entry.rarityCode) ||
      !Number.isSafeInteger(entry.weight) ||
      entry.weight < 0
    ) {
      throw new TypeError("Each rarity requires a unique code and non-negative integer weight.");
    }
    getRarityDefinition(entry.rarityCode);
    seen.add(entry.rarityCode);
    totalWeight += entry.weight;
  }
  if (totalWeight <= 0) {
    throw new TypeError("rarityWeights must contain at least one positive weight.");
  }

  return Object.freeze(
    rarityWeights
      .map(({ rarityCode, weight }) => {
        const rarity = getRarityDefinition(rarityCode);
        return Object.freeze({
          ...rarity,
          weight,
          probabilityPercent: (weight / totalWeight) * 100,
        });
      })
      .sort((left, right) => left.rank - right.rank),
  );
}
