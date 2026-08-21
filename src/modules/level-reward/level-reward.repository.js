function mapClaim(row) {
  return Object.freeze({
    playerId: row.player_id,
    milestoneLevel: Number(row.milestone_level),
    rewardSnapshot: row.reward_snapshot,
    claimedAt: row.claimed_at,
  });
}

export const levelRewardRepository = Object.freeze({
  async findPlayerForUpdate(database, playerId) {
    const result = await database.query(
      `SELECT player_id, player_level FROM players WHERE player_id = $1 FOR UPDATE`,
      [playerId],
    );
    if (!result.rows[0]) return null;
    return Object.freeze({
      playerId: result.rows[0].player_id,
      playerLevel: Number(result.rows[0].player_level),
    });
  },

  async findClaims(database, playerId) {
    const result = await database.query(
      `
        SELECT player_id, milestone_level, reward_snapshot, claimed_at
        FROM player_level_reward_claims
        WHERE player_id = $1
        ORDER BY milestone_level
      `,
      [playerId],
    );
    return Object.freeze(result.rows.map(mapClaim));
  },

  async createClaim(database, { playerId, milestoneLevel, rewardSnapshot }) {
    const result = await database.query(
      `
        INSERT INTO player_level_reward_claims (
          player_id, milestone_level, reward_snapshot
        )
        VALUES ($1, $2, $3::jsonb)
        RETURNING player_id, milestone_level, reward_snapshot, claimed_at
      `,
      [playerId, milestoneLevel, JSON.stringify(rewardSnapshot)],
    );
    return mapClaim(result.rows[0]);
  },
});
