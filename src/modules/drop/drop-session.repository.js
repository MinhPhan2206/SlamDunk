const SESSION_COLUMNS = `
  drop_session_id,
  player_id,
  drop_type,
  status,
  created_interaction_id,
  selected_template_id,
  result_card_instance_id,
  completed_at,
  selection_expires_at,
  created_at,
  updated_at
`;

function mapSession(row) {
  if (!row) {
    return null;
  }

  return Object.freeze({
    dropSessionId: row.drop_session_id,
    playerId: row.player_id,
    dropType: row.drop_type,
    status: row.status,
    createdInteractionId: row.created_interaction_id,
    selectedTemplateId: row.selected_template_id,
    resultCardInstanceId: row.result_card_instance_id,
    completedAt: row.completed_at,
    selectionExpiresAt: row.selection_expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function mapCandidate(row) {
  return Object.freeze({
    dropSessionId: row.drop_session_id,
    candidatePosition: row.candidate_position,
    cardTemplateId: row.card_template_id,
    rolledRarityTier: row.rolled_rarity_tier,
  });
}

export const dropSessionRepository = Object.freeze({
  async create(database, { playerId, dropType, interactionId, selectionExpiresAt }) {
    const result = await database.query(
      `
        INSERT INTO drop_sessions (
          player_id,
          drop_type,
          created_interaction_id,
          selection_expires_at
        )
        VALUES ($1, $2, $3, $4)
        RETURNING ${SESSION_COLUMNS}
      `,
      [playerId, dropType, interactionId, selectionExpiresAt],
    );

    return mapSession(result.rows[0]);
  },

  async createCandidates(database, dropSessionId, candidates) {
    const values = [];
    const placeholders = candidates.map((candidate, index) => {
      const offset = index * 4;
      values.push(
        dropSessionId,
        candidate.candidatePosition,
        candidate.cardTemplateId,
        candidate.rolledRarityTier,
      );
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`;
    });
    const result = await database.query(
      `
        INSERT INTO drop_session_candidates (
          drop_session_id,
          candidate_position,
          card_template_id,
          rolled_rarity_tier
        )
        VALUES ${placeholders.join(", ")}
        RETURNING
          drop_session_id,
          candidate_position,
          card_template_id,
          rolled_rarity_tier
      `,
      values,
    );

    return result.rows.map(mapCandidate);
  },

  async findCandidates(database, dropSessionId) {
    const result = await database.query(
      `
        SELECT
          drop_session_id,
          candidate_position,
          card_template_id,
          rolled_rarity_tier
        FROM drop_session_candidates
        WHERE drop_session_id = $1
        ORDER BY candidate_position
      `,
      [dropSessionId],
    );

    return result.rows.map(mapCandidate);
  },

  async findByInteractionId(database, interactionId) {
    const result = await database.query(
      `
        SELECT ${SESSION_COLUMNS}
        FROM drop_sessions
        WHERE created_interaction_id = $1
      `,
      [interactionId],
    );

    return mapSession(result.rows[0]);
  },

  async findOpenForUpdate(database, { playerId, dropType }) {
    const result = await database.query(
      `
        SELECT ${SESSION_COLUMNS}
        FROM drop_sessions
        WHERE player_id = $1 AND drop_type = $2 AND status = 'OPEN'
        FOR UPDATE
      `,
      [playerId, dropType],
    );

    return mapSession(result.rows[0]);
  },

  async findByIdForUpdate(database, dropSessionId) {
    const result = await database.query(
      `
        SELECT ${SESSION_COLUMNS}
        FROM drop_sessions
        WHERE drop_session_id = $1
        FOR UPDATE
      `,
      [dropSessionId],
    );

    return mapSession(result.rows[0]);
  },

  async findExpiredOpen(database) {
    const result = await database.query(
      `
        SELECT ${SESSION_COLUMNS}
        FROM drop_sessions
        WHERE status = 'OPEN' AND selection_expires_at <= CURRENT_TIMESTAMP
        ORDER BY drop_session_id
      `,
    );
    return result.rows.map(mapSession);
  },

  async complete(
    database,
    { dropSessionId, selectedTemplateId, resultCardInstanceId },
  ) {
    const result = await database.query(
      `
        UPDATE drop_sessions
        SET
          status = 'COMPLETED',
          selected_template_id = $2,
          result_card_instance_id = $3,
          completed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE drop_session_id = $1 AND status = 'OPEN'
        RETURNING ${SESSION_COLUMNS}
      `,
      [dropSessionId, selectedTemplateId, resultCardInstanceId],
    );

    return mapSession(result.rows[0]);
  },
});
