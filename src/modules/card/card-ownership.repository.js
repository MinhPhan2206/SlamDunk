function mapOwnershipHistory(row) {
  if (!row) {
    return null;
  }

  return Object.freeze({
    ownershipHistoryId: row.ownership_history_id,
    cardInstanceId: row.card_instance_id,
    fromPlayerId: row.from_player_id,
    toPlayerId: row.to_player_id,
    reason: row.reason,
    referenceType: row.reference_type,
    referenceId: row.reference_id,
    createdAt: row.created_at,
  });
}

export const cardOwnershipRepository = Object.freeze({
  async create(
    database,
    {
      cardInstanceId,
      fromPlayerId,
      toPlayerId,
      reason,
      referenceType,
      referenceId,
    },
  ) {
    const result = await database.query(
      `
        INSERT INTO card_ownership_history (
          card_instance_id,
          from_player_id,
          to_player_id,
          reason,
          reference_type,
          reference_id
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING
          ownership_history_id,
          card_instance_id,
          from_player_id,
          to_player_id,
          reason,
          reference_type,
          reference_id,
          created_at
      `,
      [
        cardInstanceId,
        fromPlayerId,
        toPlayerId,
        reason,
        referenceType,
        referenceId,
      ],
    );

    return mapOwnershipHistory(result.rows[0]);
  },

  async findByCardInstanceId(database, cardInstanceId) {
    const result = await database.query(
      `
        SELECT
          ownership_history_id,
          card_instance_id,
          from_player_id,
          to_player_id,
          reason,
          reference_type,
          reference_id,
          created_at
        FROM card_ownership_history
        WHERE card_instance_id = $1
        ORDER BY ownership_history_id
      `,
      [cardInstanceId],
    );

    return result.rows.map(mapOwnershipHistory);
  },
});
