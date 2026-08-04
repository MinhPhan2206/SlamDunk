const CARD_INSTANCE_COLUMNS = `
  card_instance_id,
  card_template_id,
  owner_player_id,
  serial_number,
  card_level,
  status,
  obtained_method,
  obtained_at,
  ownership_cycles,
  games_played,
  market_lock,
  trade_lock,
  created_at,
  updated_at
`;

function mapCardInstance(row) {
  if (!row) {
    return null;
  }

  return Object.freeze({
    cardInstanceId: row.card_instance_id,
    cardTemplateId: row.card_template_id,
    ownerPlayerId: row.owner_player_id,
    serialNumber: row.serial_number,
    cardLevel: row.card_level,
    status: row.status,
    obtainedMethod: row.obtained_method,
    obtainedAt: row.obtained_at,
    ownershipCycles: row.ownership_cycles,
    gamesPlayed: row.games_played,
    marketLock: row.market_lock,
    tradeLock: row.trade_lock,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export const cardInstanceRepository = Object.freeze({
  async findById(database, cardInstanceId) {
    const result = await database.query(
      `
        SELECT ${CARD_INSTANCE_COLUMNS}
        FROM card_instances
        WHERE card_instance_id = $1
      `,
      [cardInstanceId],
    );

    return mapCardInstance(result.rows[0]);
  },

  async create(
    database,
    {
      cardTemplateId,
      ownerPlayerId,
      serialNumber,
      cardLevel,
      obtainedMethod,
    },
  ) {
    const result = await database.query(
      `
        INSERT INTO card_instances (
          card_template_id,
          owner_player_id,
          serial_number,
          card_level,
          obtained_method
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING ${CARD_INSTANCE_COLUMNS}
      `,
      [
        cardTemplateId,
        ownerPlayerId,
        serialNumber,
        cardLevel,
        obtainedMethod,
      ],
    );

    return mapCardInstance(result.rows[0]);
  },
});
