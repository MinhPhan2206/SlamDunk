const SESSION_COLUMNS = `
  pack_session_id,
  player_id,
  pack_type,
  status,
  created_interaction_id,
  selected_template_id,
  result_card_instance_id,
  completed_at,
  created_at,
  updated_at
`;

function mapSession(row) {
  if (!row) {
    return null;
  }

  return Object.freeze({
    packSessionId: row.pack_session_id,
    playerId: row.player_id,
    packType: row.pack_type,
    status: row.status,
    createdInteractionId: row.created_interaction_id,
    selectedTemplateId: row.selected_template_id,
    resultCardInstanceId: row.result_card_instance_id,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function mapCandidate(row) {
  return Object.freeze({
    packSessionId: row.pack_session_id,
    candidatePosition: row.candidate_position,
    cardTemplateId: row.card_template_id,
    rolledRarityTier: row.rolled_rarity_tier,
  });
}

export const packSessionRepository = Object.freeze({
  async create(database, { playerId, packType, interactionId }) {
    const result = await database.query(
      `
        INSERT INTO pack_sessions (
          player_id,
          pack_type,
          created_interaction_id
        )
        VALUES ($1, $2, $3)
        RETURNING ${SESSION_COLUMNS}
      `,
      [playerId, packType, interactionId],
    );

    return mapSession(result.rows[0]);
  },

  async createCandidates(database, packSessionId, candidates) {
    const values = [];
    const placeholders = candidates.map((candidate, index) => {
      const offset = index * 4;
      values.push(
        packSessionId,
        candidate.candidatePosition,
        candidate.cardTemplateId,
        candidate.rolledRarityTier,
      );
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`;
    });
    const result = await database.query(
      `
        INSERT INTO pack_session_candidates (
          pack_session_id,
          candidate_position,
          card_template_id,
          rolled_rarity_tier
        )
        VALUES ${placeholders.join(", ")}
        RETURNING
          pack_session_id,
          candidate_position,
          card_template_id,
          rolled_rarity_tier
      `,
      values,
    );

    return result.rows.map(mapCandidate);
  },

  async findCandidates(database, packSessionId) {
    const result = await database.query(
      `
        SELECT
          pack_session_id,
          candidate_position,
          card_template_id,
          rolled_rarity_tier
        FROM pack_session_candidates
        WHERE pack_session_id = $1
        ORDER BY candidate_position
      `,
      [packSessionId],
    );

    return result.rows.map(mapCandidate);
  },

  async findByInteractionId(database, interactionId) {
    const result = await database.query(
      `
        SELECT ${SESSION_COLUMNS}
        FROM pack_sessions
        WHERE created_interaction_id = $1
      `,
      [interactionId],
    );

    return mapSession(result.rows[0]);
  },

  async findOpenForUpdate(database, { playerId, packType }) {
    const result = await database.query(
      `
        SELECT ${SESSION_COLUMNS}
        FROM pack_sessions
        WHERE player_id = $1 AND pack_type = $2 AND status = 'OPEN'
        FOR UPDATE
      `,
      [playerId, packType],
    );

    return mapSession(result.rows[0]);
  },

  async findByIdForUpdate(database, packSessionId) {
    const result = await database.query(
      `
        SELECT ${SESSION_COLUMNS}
        FROM pack_sessions
        WHERE pack_session_id = $1
        FOR UPDATE
      `,
      [packSessionId],
    );

    return mapSession(result.rows[0]);
  },

  async complete(
    database,
    { packSessionId, selectedTemplateId, resultCardInstanceId },
  ) {
    const result = await database.query(
      `
        UPDATE pack_sessions
        SET
          status = 'COMPLETED',
          selected_template_id = $2,
          result_card_instance_id = $3,
          completed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE pack_session_id = $1 AND status = 'OPEN'
        RETURNING ${SESSION_COLUMNS}
      `,
      [packSessionId, selectedTemplateId, resultCardInstanceId],
    );

    return mapSession(result.rows[0]);
  },
});
