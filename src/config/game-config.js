export const gameConfig = Object.freeze({
  claim: Object.freeze({
    cooldownMinutes: 30,
    minimumGold: 300,
    maximumGold: 500,
  }),
  drop: Object.freeze({
    cooldownMinutes: 15,
    candidateCount: 3,
    selectionSeconds: 10,
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
  packs: Object.freeze([
    Object.freeze({
      packCode: "standard",
      displayName: "Standard Pack",
      default: true,
      priceGold: 1_000,
      cooldownSeconds: 1,
      cardCount: 1,
      rarityWeights: Object.freeze([
        Object.freeze({ rarityTier: 1, weight: 100_000 }),
        Object.freeze({ rarityTier: 2, weight: 350_000 }),
        Object.freeze({ rarityTier: 3, weight: 400_000 }),
        Object.freeze({ rarityTier: 4, weight: 120_000 }),
        Object.freeze({ rarityTier: 5, weight: 27_000 }),
        Object.freeze({ rarityTier: 6, weight: 2_900 }),
        Object.freeze({ rarityTier: 7, weight: 100 }),
      ]),
    }),
  ]),
  daily: Object.freeze({
    cooldownHours: 24,
    minimumGold: 1_500,
    maximumGold: 2_000,
    minimumShards: 20,
    maximumShards: 30,
  }),
  exchange: Object.freeze({
    shard: Object.freeze({
      levelUpCost: 500,
      levelUpQuantity: 1,
    }),
  }),
  trade: Object.freeze({
    maximumCardsPerPlayer: 10,
    maximumGoldPerPlayer: 20_000_000,
    expiryMinutes: 3,
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
  upgrade: Object.freeze({
    maximumCardLevel: 5,
    levelUpItemType: "LEVEL_UP",
    levelUpItemName: "Level Up",
  }),
});
