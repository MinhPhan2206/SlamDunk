const CARD_INSTANCE_COLUMNS = `
  card_instance_id,
  public_card_id,
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
    publicCardId: row.public_card_id,
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
  async isInLineup(database, cardInstanceId) {
    const result = await database.query(
      "SELECT EXISTS (SELECT 1 FROM lineup_slots WHERE card_instance_id = $1) AS in_lineup",
      [cardInstanceId],
    );
    return result.rows[0].in_lineup;
  },

  async incrementGamesPlayed(database, { ownerPlayerId, cardInstanceIds }) {
    const result = await database.query(
      `
        UPDATE card_instances
        SET games_played = games_played + 1, updated_at = CURRENT_TIMESTAMP
        WHERE owner_player_id = $1
          AND status = 'ACTIVE'
          AND card_instance_id = ANY($2::bigint[])
        RETURNING card_instance_id
      `,
      [ownerPlayerId, cardInstanceIds],
    );
    return result.rows.map((row) => row.card_instance_id);
  },

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

  async findByIdForUpdate(database, cardInstanceId) {
    const result = await database.query(
      `
        SELECT ${CARD_INSTANCE_COLUMNS}
        FROM card_instances
        WHERE card_instance_id = $1
        FOR UPDATE
      `,
      [cardInstanceId],
    );

    return mapCardInstance(result.rows[0]);
  },

  async findByIdsForUpdate(database, cardInstanceIds) {
    const result = await database.query(
      `
        SELECT ${CARD_INSTANCE_COLUMNS}
        FROM card_instances
        WHERE card_instance_id = ANY($1::BIGINT[])
        ORDER BY card_instance_id
        FOR UPDATE
      `,
      [cardInstanceIds],
    );

    return result.rows.map(mapCardInstance);
  },

  async setMarketLock(database, { cardInstanceId, marketLock }) {
    const result = await database.query(
      `
        UPDATE card_instances
        SET market_lock = $2, updated_at = CURRENT_TIMESTAMP
        WHERE card_instance_id = $1
        RETURNING ${CARD_INSTANCE_COLUMNS}
      `,
      [cardInstanceId, marketLock],
    );

    return mapCardInstance(result.rows[0]);
  },

  async setTradeLock(database, { cardInstanceId, tradeLock }) {
    const result = await database.query(
      `
        UPDATE card_instances
        SET trade_lock = $2, updated_at = CURRENT_TIMESTAMP
        WHERE card_instance_id = $1
        RETURNING ${CARD_INSTANCE_COLUMNS}
      `,
      [cardInstanceId, tradeLock],
    );

    return mapCardInstance(result.rows[0]);
  },

  async removeFromLineups(database, cardInstanceId) {
    await database.query(
      `DELETE FROM lineup_slots WHERE card_instance_id = $1`,
      [cardInstanceId],
    );
  },

  async transferMarketOwnership(
    database,
    { cardInstanceId, fromPlayerId, toPlayerId },
  ) {
    const result = await database.query(
      `
        UPDATE card_instances
        SET
          owner_player_id = $3,
          ownership_cycles = ownership_cycles + 1,
          market_lock = FALSE,
          updated_at = CURRENT_TIMESTAMP
        WHERE card_instance_id = $1
          AND owner_player_id = $2
          AND status = 'ACTIVE'
          AND market_lock = TRUE
          AND trade_lock = FALSE
        RETURNING ${CARD_INSTANCE_COLUMNS}
      `,
      [cardInstanceId, fromPlayerId, toPlayerId],
    );

    return mapCardInstance(result.rows[0]);
  },

  async transferTradeOwnership(
    database,
    { cardInstanceId, fromPlayerId, toPlayerId },
  ) {
    const result = await database.query(
      `
        UPDATE card_instances
        SET
          owner_player_id = $3,
          ownership_cycles = ownership_cycles + 1,
          trade_lock = FALSE,
          updated_at = CURRENT_TIMESTAMP
        WHERE card_instance_id = $1
          AND owner_player_id = $2
          AND status = 'ACTIVE'
          AND market_lock = FALSE
          AND trade_lock = TRUE
        RETURNING ${CARD_INSTANCE_COLUMNS}
      `,
      [cardInstanceId, fromPlayerId, toPlayerId],
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
      publicCardId,
    },
  ) {
    const result = await database.query(
      `
        INSERT INTO card_instances (
          card_template_id,
          public_card_id,
          owner_player_id,
          serial_number,
          card_level,
          obtained_method
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (public_card_id) DO NOTHING
        RETURNING ${CARD_INSTANCE_COLUMNS}
      `,
      [
        cardTemplateId,
        publicCardId,
        ownerPlayerId,
        serialNumber,
        cardLevel,
        obtainedMethod,
      ],
    );

    return mapCardInstance(result.rows[0]);
  },
});
