import { getRarityDefinition } from "../../config/rarity-config.js";

export function buildRarityOdds(rarityWeights) {
  if (!Array.isArray(rarityWeights) || rarityWeights.length !== 7) {
    throw new TypeError("rarityWeights must define exactly 7 rarity tiers.");
  }
  const seen = new Set();
  let totalWeight = 0;
  for (const entry of rarityWeights) {
    if (
      !Number.isInteger(entry.rarityTier) ||
      seen.has(entry.rarityTier) ||
      !Number.isSafeInteger(entry.weight) ||
      entry.weight <= 0
    ) {
      throw new TypeError("Each rarity tier requires one positive integer weight.");
    }
    getRarityDefinition(entry.rarityTier);
    seen.add(entry.rarityTier);
    totalWeight += entry.weight;
  }

  return Object.freeze(
    rarityWeights
      .map(({ rarityTier, weight }) => {
        const rarity = getRarityDefinition(rarityTier);
        return Object.freeze({
          ...rarity,
          weight,
          probabilityPercent: (weight / totalWeight) * 100,
        });
      })
      .sort((left, right) => left.rarityTier - right.rarityTier),
  );
}
