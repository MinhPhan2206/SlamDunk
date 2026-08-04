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
  battle: Object.freeze({
    aiCardLevel: 3,
    levelRatingBonus: 1,
    baseTeamScore: 90,
    matchupScale: 0.35,
    randomScoreRange: 7,
    minimumScore: 60,
    maximumScore: 130,
  }),
  quicksell: Object.freeze({
    shardRewards: Object.freeze({
      1: 1,
      2: 2,
      3: 5,
      4: 30,
      5: 200,
      6: 1_500,
      7: 10_000,
    }),
  }),
});
