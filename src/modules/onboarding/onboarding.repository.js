function mapPlayer(row) {
  if (!row) return null;
  return Object.freeze({
    playerId: row.player_id,
    starterLineupGrantedAt: row.starter_lineup_granted_at,
  });
}

export const onboardingRepository = Object.freeze({
  async lockPlayer(database, playerId) {
    const result = await database.query(
      `
        SELECT player_id, starter_lineup_granted_at
        FROM players
        WHERE player_id = $1
        FOR UPDATE
      `,
      [playerId],
    );
    return mapPlayer(result.rows[0]);
  },

  async markStarterLineupGranted(database, playerId) {
    const result = await database.query(
      `
        UPDATE players
        SET starter_lineup_granted_at = CURRENT_TIMESTAMP
        WHERE player_id = $1
          AND starter_lineup_granted_at IS NULL
        RETURNING starter_lineup_granted_at
      `,
      [playerId],
    );
    return result.rows[0]?.starter_lineup_granted_at ?? null;
  },
});
