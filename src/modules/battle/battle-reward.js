const BASIS_POINTS = 10_000n;

function applyBasisPoints(value, basisPoints) {
  return Number((BigInt(value) * BigInt(basisPoints)) / BASIS_POINTS);
}

export function calculateBattleReward({
  playerScore,
  aiScore,
  currentWinStreak,
  completedBattlesToday,
  bracket,
  config,
}) {
  const won = playerScore > aiScore;
  const winStreakAfter = won ? currentWinStreak + 1 : 0;
  const baseGold = won
    ? config.winBaseGold + (playerScore - aiScore) * config.winMarginGold
    : config.lossBaseGold + playerScore * config.lossPointGold;
  const streakBonusBasisPoints = won
    ? Math.min(
        winStreakAfter * config.streakBonusBasisPointsPerWin,
        bracket.maximumStreakBonusBasisPoints,
      )
    : 0;
  const bracketAdjusted = applyBasisPoints(
    baseGold,
    bracket.rewardMultiplierBasisPoints,
  );
  const streakAdjusted = applyBasisPoints(
    bracketAdjusted,
    10_000 + streakBonusBasisPoints,
  );
  const cappedGold = Math.min(streakAdjusted, config.maximumRewardGold);
  const reducedReward = completedBattlesToday >= config.fullRewardBattlesPerDay;
  const rewardGold = reducedReward
    ? applyBasisPoints(cappedGold, config.reducedRewardBasisPoints)
    : cappedGold;

  return Object.freeze({
    won,
    baseGold,
    rewardGold,
    bracketCode: bracket.code,
    bracketName: bracket.displayName,
    bracketMultiplierBasisPoints: bracket.rewardMultiplierBasisPoints,
    winStreakAfter,
    streakBonusBasisPoints,
    battleNumberToday: completedBattlesToday + 1,
    reducedReward,
  });
}
