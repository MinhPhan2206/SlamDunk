export const gameConfig = Object.freeze({
  claim: Object.freeze({
    cooldownMinutes: 30,
    minimumGold: 300,
    maximumGold: 500,
  }),
  freeDrop: Object.freeze({
    cooldownMinutes: 15,
    candidateCount: 3,
    rarityWeights: Object.freeze([
      Object.freeze({ rarityTier: 1, weight: 500_000 }),
      Object.freeze({ rarityTier: 2, weight: 320_000 }),
      Object.freeze({ rarityTier: 3, weight: 160_000 }),
      Object.freeze({ rarityTier: 4, weight: 18_000 }),
      Object.freeze({ rarityTier: 5, weight: 1_900 }),
      Object.freeze({ rarityTier: 6, weight: 95 }),
      Object.freeze({ rarityTier: 7, weight: 5 }),
    ]),
  }),
});
