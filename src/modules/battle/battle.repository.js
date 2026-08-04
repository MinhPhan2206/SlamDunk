function mapMatch(row) {
  return Object.freeze({
    matchId: row.match_id,
    playerId: row.player_id,
    requestInteractionId: row.request_interaction_id,
    mode: row.mode,
    status: row.status,
    rngSeed: row.rng_seed,
    winnerTeam: row.winner_team,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  });
}

export const battleRepository = Object.freeze({
  async lockInteraction(database, interactionId) {
    await database.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      interactionId,
    ]);
  },

  async findByInteractionId(database, interactionId) {
    const result = await database.query(
      `SELECT * FROM matches WHERE request_interaction_id = $1`,
      [interactionId],
    );
    return result.rows[0] ? mapMatch(result.rows[0]) : null;
  },

  async createMatch(database, { playerId, interactionId, rngSeed }) {
    const result = await database.query(
      `
        INSERT INTO matches (
          player_id,
          request_interaction_id,
          mode,
          rng_seed
        )
        VALUES ($1, $2, 'PVE_5V5', $3)
        RETURNING *
      `,
      [playerId, interactionId, rngSeed],
    );
    return mapMatch(result.rows[0]);
  },

  async createTeam(database, { matchId, playerId, teamNumber, teamName, finalScore }) {
    const result = await database.query(
      `
        INSERT INTO match_teams (
          match_id,
          player_id,
          team_number,
          team_name,
          final_score
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING match_team_id
      `,
      [matchId, playerId, teamNumber, teamName, finalScore],
    );
    return result.rows[0].match_team_id;
  },

  async createPlayers(database, matchTeamId, players) {
    for (const player of players) {
      await database.query(
        `
          INSERT INTO match_players (
            match_team_id,
            card_instance_id,
            card_template_id,
            slot,
            card_level_snapshot,
            card_name_snapshot,
            base_stats_snapshot,
            traits_snapshot,
            pts
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9)
        `,
        [
          matchTeamId,
          player.cardInstanceId,
          player.cardTemplateId,
          player.slot,
          player.cardLevel,
          player.cardName,
          JSON.stringify(player.stats),
          JSON.stringify(player.traits),
          player.points,
        ],
      );
    }
  },

  async completeMatch(database, { matchId, winnerTeam }) {
    const result = await database.query(
      `
        UPDATE matches
        SET
          status = 'COMPLETED',
          winner_team = $2,
          completed_at = CURRENT_TIMESTAMP
        WHERE match_id = $1
        RETURNING *
      `,
      [matchId, winnerTeam],
    );
    return mapMatch(result.rows[0]);
  },

  async loadResult(database, match) {
    const teamsResult = await database.query(
      `
        SELECT match_team_id, team_number, team_name, final_score
        FROM match_teams
        WHERE match_id = $1
        ORDER BY team_number
      `,
      [match.matchId],
    );
    const teams = [];
    for (const team of teamsResult.rows) {
      const playersResult = await database.query(
        `
          SELECT slot, card_name_snapshot, card_level_snapshot, pts
          FROM match_players
          WHERE match_team_id = $1
          ORDER BY CASE slot
            WHEN 'PG' THEN 1 WHEN 'SG' THEN 2 WHEN 'SF' THEN 3
            WHEN 'PF' THEN 4 ELSE 5 END
        `,
        [team.match_team_id],
      );
      teams.push(
        Object.freeze({
          teamNumber: team.team_number,
          teamName: team.team_name,
          finalScore: team.final_score,
          players: Object.freeze(
            playersResult.rows.map((player) =>
              Object.freeze({
                slot: player.slot,
                cardName: player.card_name_snapshot,
                cardLevel: player.card_level_snapshot,
                points: player.pts,
              }),
            ),
          ),
        }),
      );
    }
    return Object.freeze({ match, teams: Object.freeze(teams), replayed: true });
  },
});
