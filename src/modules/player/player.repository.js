const PLAYER_COLUMNS = `
  player_id,
  discord_user_id,
  username_snapshot,
  player_level,
  xp,
  games_played,
  games_won,
  games_lost,
  current_win_streak,
  highest_win_streak,
  starter_lineup_granted_at,
  created_at,
  last_active_at
`;

function mapPlayer(row) {
  if (!row) {
    return null;
  }

  return Object.freeze({
    playerId: row.player_id,
    discordUserId: row.discord_user_id,
    usernameSnapshot: row.username_snapshot,
    playerLevel: row.player_level,
    xp: row.xp,
    gamesPlayed: row.games_played,
    gamesWon: row.games_won,
    gamesLost: row.games_lost,
    currentWinStreak: row.current_win_streak,
    highestWinStreak: row.highest_win_streak,
    starterLineupGrantedAt: row.starter_lineup_granted_at,
    createdAt: row.created_at,
    lastActiveAt: row.last_active_at,
  });
}

function mapXpTransaction(row) {
  if (!row) return null;
  return Object.freeze({
    xpTransactionId: row.xp_transaction_id,
    playerId: row.player_id,
    amount: row.amount,
    sourceType: row.source_type,
    referenceId: row.reference_id,
    idempotencyKey: row.idempotency_key,
    xpAfter: row.xp_after,
    playerLevelAfter: row.player_level_after,
    createdAt: row.created_at,
  });
}

export const playerRepository = Object.freeze({
  async findXpTransactionByIdempotencyKey(database, idempotencyKey) {
    const result = await database.query(
      `
        SELECT *
        FROM player_xp_transactions
        WHERE idempotency_key = $1
      `,
      [idempotencyKey],
    );
    return mapXpTransaction(result.rows[0]);
  },

  async createXpTransaction(database, input) {
    const result = await database.query(
      `
        INSERT INTO player_xp_transactions (
          player_id,
          amount,
          source_type,
          reference_id,
          idempotency_key,
          xp_after,
          player_level_after
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `,
      [
        input.playerId,
        input.amount,
        input.sourceType,
        input.referenceId,
        input.idempotencyKey,
        input.xpAfter,
        input.playerLevelAfter,
      ],
    );
    return mapXpTransaction(result.rows[0]);
  },

  async updateProgression(database, { playerId, xp, playerLevel }) {
    const result = await database.query(
      `
        UPDATE players
        SET
          xp = $2,
          player_level = $3,
          last_active_at = CURRENT_TIMESTAMP
        WHERE player_id = $1
        RETURNING ${PLAYER_COLUMNS}
      `,
      [playerId, xp, playerLevel],
    );
    return mapPlayer(result.rows[0]);
  },

  async recordBattleResult(database, { playerId, won }) {
    const result = await database.query(
      `
        UPDATE players
        SET
          games_played = games_played + 1,
          games_won = games_won + CASE WHEN $2 THEN 1 ELSE 0 END,
          games_lost = games_lost + CASE WHEN $2 THEN 0 ELSE 1 END,
          current_win_streak = CASE
            WHEN $2 THEN current_win_streak + 1
            ELSE 0
          END,
          highest_win_streak = CASE
            WHEN $2 THEN GREATEST(highest_win_streak, current_win_streak + 1)
            ELSE highest_win_streak
          END,
          last_active_at = CURRENT_TIMESTAMP
        WHERE player_id = $1
        RETURNING ${PLAYER_COLUMNS}
      `,
      [playerId, won],
    );

    return mapPlayer(result.rows[0]);
  },

  async findById(database, playerId) {
    const result = await database.query(
      `SELECT ${PLAYER_COLUMNS} FROM players WHERE player_id = $1`,
      [playerId],
    );

    return mapPlayer(result.rows[0]);
  },

  async findByIds(database, playerIds) {
    if (!Array.isArray(playerIds) || playerIds.length === 0) {
      return Object.freeze([]);
    }
    const result = await database.query(
      `SELECT ${PLAYER_COLUMNS} FROM players WHERE player_id = ANY($1::BIGINT[])`,
      [playerIds],
    );
    return Object.freeze(result.rows.map(mapPlayer));
  },

  async findByIdForUpdate(database, playerId) {
    const result = await database.query(
      `SELECT ${PLAYER_COLUMNS} FROM players WHERE player_id = $1 FOR UPDATE`,
      [playerId],
    );
    return mapPlayer(result.rows[0]);
  },

  async findByDiscordUserId(database, discordUserId) {
    const result = await database.query(
      `SELECT ${PLAYER_COLUMNS} FROM players WHERE discord_user_id = $1`,
      [discordUserId],
    );

    return mapPlayer(result.rows[0]);
  },

  async upsertFromDiscord(database, { discordUserId, usernameSnapshot }) {
    const result = await database.query(
      `
        INSERT INTO players (discord_user_id, username_snapshot)
        VALUES ($1, $2)
        ON CONFLICT (discord_user_id) DO UPDATE
        SET
          username_snapshot = EXCLUDED.username_snapshot,
          last_active_at = CURRENT_TIMESTAMP
        RETURNING ${PLAYER_COLUMNS}
      `,
      [discordUserId, usernameSnapshot],
    );

    return mapPlayer(result.rows[0]);
  },
});
