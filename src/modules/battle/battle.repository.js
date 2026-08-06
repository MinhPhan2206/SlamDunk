function mapMatch(row) {
  return Object.freeze({
    matchId: row.match_id,
    playerId: row.player_id,
    requestInteractionId: row.request_interaction_id,
    mode: row.mode,
    status: row.status,
    rngSeed: Number(row.rng_seed),
    engineVersion: row.engine_version,
    rulesetVersion: row.ruleset_version,
    configVersion: row.config_version,
    inputSnapshot: row.input_snapshot,
    playByPlay: row.play_by_play,
    possessionCount: row.possession_count,
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

  async findByIdForUpdate(database, matchId) {
    const result = await database.query(
      `SELECT * FROM matches WHERE match_id = $1 FOR UPDATE`,
      [matchId],
    );
    return result.rows[0] ? mapMatch(result.rows[0]) : null;
  },

  async createMatch(
    database,
    {
      playerId,
      interactionId,
      rngSeed,
      engineVersion,
      rulesetVersion,
      configVersion,
      inputSnapshot,
    },
  ) {
    const result = await database.query(
      `
        INSERT INTO matches (
          player_id,
          request_interaction_id,
          mode,
          rng_seed,
          engine_version,
          ruleset_version,
          config_version,
          input_snapshot
        )
        VALUES ($1, $2, 'PVE_5V5', $3, $4, $5, $6, $7::jsonb)
        RETURNING *
      `,
      [
        playerId,
        interactionId,
        rngSeed,
        engineVersion,
        rulesetVersion,
        configVersion,
        JSON.stringify(inputSnapshot),
      ],
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
            pts,
            reb,
            ast,
            stl,
            blk,
            tov,
            fgm,
            fga,
            three_pm,
            three_pa
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb,
            $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
          )
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
          player.rebounds,
          player.assists,
          player.steals,
          player.blocks,
          player.turnovers,
          player.fieldGoalsMade,
          player.fieldGoalsAttempted,
          player.threePointersMade,
          player.threePointersAttempted,
        ],
      );
    }
  },

  async completeMatch(
    database,
    { matchId, winnerTeam, possessionCount, playByPlay },
  ) {
    const result = await database.query(
      `
        UPDATE matches
        SET
          status = 'COMPLETED',
          winner_team = $2,
          possession_count = $3,
          play_by_play = $4::jsonb,
          completed_at = CURRENT_TIMESTAMP
        WHERE match_id = $1 AND status = 'IN_PROGRESS'
        RETURNING *
      `,
      [matchId, winnerTeam, possessionCount, JSON.stringify(playByPlay)],
    );
    return result.rows[0] ? mapMatch(result.rows[0]) : null;
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
          SELECT
            slot,
            card_name_snapshot,
            card_level_snapshot,
            pts,
            reb,
            ast,
            stl,
            blk,
            tov,
            fgm,
            fga,
            three_pm,
            three_pa
          FROM match_players
          WHERE match_team_id = $1
          ORDER BY CASE slot
            WHEN 'PG' THEN 1 WHEN 'SG' THEN 2 WHEN 'SF' THEN 3
            WHEN 'PF' THEN 4 ELSE 5 END
        `,
        [team.match_team_id],
      );
      teams.push(Object.freeze({
        teamNumber: team.team_number,
        teamName: team.team_name,
        finalScore: team.final_score,
        players: Object.freeze(playersResult.rows.map((player) => Object.freeze({
          slot: player.slot,
          cardName: player.card_name_snapshot,
          cardLevel: player.card_level_snapshot,
          points: player.pts,
          rebounds: player.reb,
          assists: player.ast,
          steals: player.stl,
          blocks: player.blk,
          turnovers: player.tov,
          fieldGoalsMade: player.fgm,
          fieldGoalsAttempted: player.fga,
          threePointersMade: player.three_pm,
          threePointersAttempted: player.three_pa,
        }))),
      }));
    }
    return Object.freeze({ match, teams: Object.freeze(teams), replayed: true });
  },
});
