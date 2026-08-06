function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function createSeededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function playerRatings(player, config) {
  const stats = player.stats;
  const levelBonus = (player.cardLevel - 1) * config.levelRatingBonus;
  const heightRating = clamp(
    50 + ((stats.heightCm ?? 198) - 180) * 1.5,
    40,
    99,
  );
  const offense =
    (stats.finishing +
      stats.midRange +
      stats.threePoint +
      stats.playmaking) /
      4 +
    levelBonus;
  const defense =
    (stats.perimeterDefense +
      stats.interiorDefense +
      stats.strength +
      heightRating) /
      4 +
    levelBonus;
  const scoringWeight = Math.max(
    1,
    stats.finishing + stats.midRange + stats.threePoint,
  );

  return { offense, defense, scoringWeight };
}

function teamRatings(players, config) {
  const ratings = players.map((player) => playerRatings(player, config));
  return {
    offense: ratings.reduce((sum, rating) => sum + rating.offense, 0) / ratings.length,
    defense: ratings.reduce((sum, rating) => sum + rating.defense, 0) / ratings.length,
    scoringWeights: ratings.map((rating) => rating.scoringWeight),
  };
}

function allocatePoints(players, weights, score) {
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const allocations = weights.map((weight, index) => {
    const exact = (score * weight) / totalWeight;
    return { index, points: Math.floor(exact), remainder: exact % 1 };
  });
  let remaining = score - allocations.reduce((sum, item) => sum + item.points, 0);
  const remainderOrder = [...allocations].sort(
    (left, right) => right.remainder - left.remainder || left.index - right.index,
  );

  for (let index = 0; index < remaining; index += 1) {
    remainderOrder[index % remainderOrder.length].points += 1;
  }

  return players.map((player, index) =>
    Object.freeze({ ...player, points: allocations[index].points }),
  );
}

export function simulateBattle({ playerTeam, aiTeam, seed, config }) {
  const random = createSeededRandom(seed);
  const playerRatingsValue = teamRatings(playerTeam, config);
  const aiRatingsValue = teamRatings(aiTeam, config);
  const randomSwing = () =>
    (random() * 2 - 1) * config.randomScoreRange;
  let playerScore = clamp(
    Math.round(
      config.baseTeamScore +
        (playerRatingsValue.offense - aiRatingsValue.defense) *
          config.matchupScale +
        randomSwing(),
    ),
    config.minimumScore,
    config.maximumScore,
  );
  let aiScore = clamp(
    Math.round(
      config.baseTeamScore +
        (aiRatingsValue.offense - playerRatingsValue.defense) *
          config.matchupScale +
        randomSwing(),
    ),
    config.minimumScore,
    config.maximumScore,
  );

  if (playerScore === aiScore) {
    if (random() < 0.5) {
      playerScore += 1;
    } else {
      aiScore += 1;
    }
  }

  return Object.freeze({
    winnerTeam: playerScore > aiScore ? 1 : 2,
    playerScore,
    aiScore,
    playerTeam: Object.freeze(
      allocatePoints(
        playerTeam,
        playerRatingsValue.scoringWeights,
        playerScore,
      ),
    ),
    aiTeam: Object.freeze(
      allocatePoints(aiTeam, aiRatingsValue.scoringWeights, aiScore),
    ),
  });
}
