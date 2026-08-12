const BASIS_POINTS = 10_000n;

function applyBasisPoints(value, basisPoints) {
  return Number((BigInt(value) * BigInt(basisPoints)) / BASIS_POINTS);
}

export function calculateStreakBonusBasisPoints(winStreak, config) {
  if (!Number.isSafeInteger(winStreak) || winStreak < 0) {
    throw new TypeError("winStreak must be a non-negative safe integer.");
  }
  const firstFiveWins = Math.min(winStreak, 5);
  const nextFiveWins = Math.min(Math.max(winStreak - 5, 0), 5);
  const winsAfterTen = Math.max(winStreak - 10, 0);
  return firstFiveWins * config.firstFive +
    nextFiveWins * config.nextFive +
    winsAfterTen * config.afterTen;
}

export function calculateBattleReward({
  playerScore,
  aiScore,
  currentWinStreak,
  bracket,
  config,
}) {
  const won = playerScore > aiScore;
  const winStreakAfter = won ? currentWinStreak + 1 : 0;
  const scoreBonusGold = won
    ? (playerScore - aiScore) * config.winMarginGold
    : playerScore * config.lossPointGold;
  const fixedBaseGold = won ? config.winBaseGold : config.lossBaseGold;
  const baseGold = fixedBaseGold + scoreBonusGold;
  const streakBonusBasisPoints = won
    ? calculateStreakBonusBasisPoints(
        winStreakAfter,
        config.streakBonusBasisPointsPerWin,
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
  const rewardGold = streakAdjusted;

  return Object.freeze({
    won,
    fixedBaseGold,
    scoreBonusGold,
    baseGold,
    bracketAdjustedGold: bracketAdjusted,
    bracketAdjustmentGold: bracketAdjusted - baseGold,
    streakBonusGold: rewardGold - bracketAdjusted,
    rewardGold,
    bracketCode: bracket.code,
    bracketName: bracket.displayName,
    bracketMultiplierBasisPoints: bracket.rewardMultiplierBasisPoints,
    winStreakAfter,
    streakBonusBasisPoints,
  });
}
