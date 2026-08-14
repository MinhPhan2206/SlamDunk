function mapCooldown(row) {
  if (!row) {
    return null;
  }

  return Object.freeze({
    playerId: row.player_id,
    cooldownType: row.cooldown_type,
    availableAt: row.available_at,
    chargesRemaining: row.charges_remaining,
    updatedAt: row.updated_at,
  });
}

export const cooldownRepository = Object.freeze({
  async getDatabaseTime(database) {
    const result = await database.query(
      "SELECT CURRENT_TIMESTAMP AS current_time",
    );

    return result.rows[0].current_time;
  },

  async getOrCreateForUpdate(database, { playerId, cooldownType }) {
    await database.query(
      `
        INSERT INTO player_cooldowns (
          player_id,
          cooldown_type,
          charges_remaining
        )
        VALUES (
          $1,
          $2,
          CASE WHEN $2 IN ('CLAIM', 'FREE_DROP') THEN 2 ELSE NULL END
        )
        ON CONFLICT (player_id, cooldown_type) DO NOTHING
      `,
      [playerId, cooldownType],
    );

    const result = await database.query(
      `
        SELECT player_id, cooldown_type, available_at, charges_remaining, updated_at
        FROM player_cooldowns
        WHERE player_id = $1 AND cooldown_type = $2
        FOR UPDATE
      `,
      [playerId, cooldownType],
    );

    return mapCooldown(result.rows[0]);
  },

  async find(database, { playerId, cooldownType }) {
    const result = await database.query(
      `
        SELECT player_id, cooldown_type, available_at, charges_remaining, updated_at
        FROM player_cooldowns
        WHERE player_id = $1 AND cooldown_type = $2
      `,
      [playerId, cooldownType],
    );

    return mapCooldown(result.rows[0]);
  },

  async setAvailableAt(database, { playerId, cooldownType, availableAt }) {
    const result = await database.query(
      `
        UPDATE player_cooldowns
        SET available_at = $3, updated_at = CURRENT_TIMESTAMP
        WHERE player_id = $1 AND cooldown_type = $2
        RETURNING player_id, cooldown_type, available_at, charges_remaining, updated_at
      `,
      [playerId, cooldownType, availableAt],
    );

    return mapCooldown(result.rows[0]);
  },

  async setChargeState(
    database,
    { playerId, cooldownType, chargesRemaining, nextChargeAt },
  ) {
    const result = await database.query(
      `
        UPDATE player_cooldowns
        SET
          charges_remaining = $3,
          available_at = $4,
          updated_at = CURRENT_TIMESTAMP
        WHERE player_id = $1 AND cooldown_type = $2
        RETURNING player_id, cooldown_type, available_at,
          charges_remaining, updated_at
      `,
      [playerId, cooldownType, chargesRemaining, nextChargeAt],
    );
    return mapCooldown(result.rows[0]);
  },
});
