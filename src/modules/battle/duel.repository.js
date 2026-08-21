function mapChallenge(row) {
  if (!row) return null;
  return Object.freeze({
    duelChallengeId: row.duel_challenge_id,
    publicDuelId: row.public_duel_id,
    requestInteractionId: row.request_interaction_id,
    challengerPlayerId: row.challenger_player_id,
    challengedPlayerId: row.challenged_player_id,
    betGold: row.bet_gold ?? "0",
    status: row.status,
    matchId: row.match_id,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at,
    closedAt: row.closed_at,
    createdAt: row.created_at,
  });
}

export const duelRepository = Object.freeze({
  async lockPlayers(database, playerIds) {
    const ordered = [...new Set(playerIds.map(String))].sort((left, right) =>
      BigInt(left) < BigInt(right) ? -1 : 1
    );
    for (const playerId of ordered) {
      await database.query(
        "SELECT pg_advisory_xact_lock(hashtext($1))",
        [`duel-player:${playerId}`],
      );
    }
  },

  async findByInteractionId(database, interactionId) {
    const result = await database.query(
      "SELECT * FROM duel_challenges WHERE request_interaction_id = $1",
      [interactionId],
    );
    return mapChallenge(result.rows[0]);
  },

  async findByPublicIdForUpdate(database, publicDuelId) {
    const result = await database.query(
      "SELECT * FROM duel_challenges WHERE public_duel_id = $1 FOR UPDATE",
      [publicDuelId],
    );
    return mapChallenge(result.rows[0]);
  },

  async findActiveForPlayers(database, playerIds) {
    const result = await database.query(
      `
        SELECT *
        FROM duel_challenges
        WHERE status = 'PENDING'
          AND expires_at > CURRENT_TIMESTAMP
          AND (
            challenger_player_id = ANY($1::bigint[])
            OR challenged_player_id = ANY($1::bigint[])
          )
        ORDER BY duel_challenge_id
        LIMIT 1
      `,
      [playerIds],
    );
    return mapChallenge(result.rows[0]);
  },

  async create(database, input) {
    const result = await database.query(
      `
        INSERT INTO duel_challenges (
          public_duel_id, request_interaction_id,
          challenger_player_id, challenged_player_id, bet_gold, expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `,
      [
        input.publicDuelId,
        input.interactionId,
        input.challengerPlayerId,
        input.challengedPlayerId,
        input.betGold,
        input.expiresAt,
      ],
    );
    return mapChallenge(result.rows[0]);
  },

  async listExpiredPendingPublicIds(database, limit = 100) {
    const result = await database.query(
      `
        SELECT public_duel_id
        FROM duel_challenges
        WHERE status = 'PENDING' AND expires_at <= CURRENT_TIMESTAMP
        ORDER BY expires_at, duel_challenge_id
        LIMIT $1
      `,
      [limit],
    );
    return result.rows.map((row) => row.public_duel_id);
  },

  async accept(database, { duelChallengeId, matchId }) {
    const result = await database.query(
      `
        UPDATE duel_challenges
        SET status = 'ACCEPTED', match_id = $2, accepted_at = CURRENT_TIMESTAMP
        WHERE duel_challenge_id = $1 AND status = 'PENDING'
        RETURNING *
      `,
      [duelChallengeId, matchId],
    );
    return mapChallenge(result.rows[0]);
  },

  async close(database, { duelChallengeId, status }) {
    const result = await database.query(
      `
        UPDATE duel_challenges
        SET status = $2, closed_at = CURRENT_TIMESTAMP
        WHERE duel_challenge_id = $1 AND status = 'PENDING'
        RETURNING *
      `,
      [duelChallengeId, status],
    );
    return mapChallenge(result.rows[0]);
  },

  async recordResult(database, { playerId, won }) {
    await database.query(
      `
        INSERT INTO player_duel_records (
          player_id, games_played, games_won, games_lost
        )
        VALUES ($1, 1, CASE WHEN $2 THEN 1 ELSE 0 END, CASE WHEN $2 THEN 0 ELSE 1 END)
        ON CONFLICT (player_id) DO UPDATE
        SET
          games_played = player_duel_records.games_played + 1,
          games_won = player_duel_records.games_won + CASE WHEN $2 THEN 1 ELSE 0 END,
          games_lost = player_duel_records.games_lost + CASE WHEN $2 THEN 0 ELSE 1 END,
          updated_at = CURRENT_TIMESTAMP
      `,
      [playerId, won],
    );
  },
});
