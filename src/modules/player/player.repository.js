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
    createdAt: row.created_at,
    lastActiveAt: row.last_active_at,
  });
}

export const playerRepository = Object.freeze({
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
