const OPENING_COLUMNS = `
  pack_opening_id, player_id, pack_code, price_gold, payment_currency,
  price_amount, pack_quantity, status,
  discord_interaction_id, card_template_id, card_instance_id,
  completed_at, created_at
`;

function mapOpening(row) {
  if (!row) return null;
  return Object.freeze({
    packOpeningId: row.pack_opening_id,
    playerId: row.player_id,
    packCode: row.pack_code,
    priceGold: row.price_gold,
    paymentCurrency: row.payment_currency,
    priceAmount: row.price_amount,
    packQuantity: row.pack_quantity,
    status: row.status,
    discordInteractionId: row.discord_interaction_id,
    cardTemplateId: row.card_template_id,
    cardInstanceId: row.card_instance_id,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  });
}

function mapOpeningCard(row) {
  return Object.freeze({
    packOpeningId: row.pack_opening_id,
    cardPosition: row.card_position,
    cardTemplateId: row.card_template_id,
    cardInstanceId: row.card_instance_id,
    createdAt: row.created_at,
  });
}

export const packOpeningRepository = Object.freeze({
  async findByInteractionId(database, interactionId) {
    const result = await database.query(
      `SELECT ${OPENING_COLUMNS} FROM pack_openings WHERE discord_interaction_id = $1`,
      [interactionId],
    );
    return mapOpening(result.rows[0]);
  },

  async create(
    database,
    {
      playerId,
      packCode,
      paymentCurrency,
      priceAmount,
      packQuantity,
      interactionId,
    },
  ) {
    const result = await database.query(
      `
        INSERT INTO pack_openings (
          player_id, pack_code, price_gold, payment_currency, price_amount,
          pack_quantity, discord_interaction_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING ${OPENING_COLUMNS}
      `,
      [
        playerId,
        packCode,
        paymentCurrency === "GOLD" ? priceAmount : 0,
        paymentCurrency,
        priceAmount,
        packQuantity,
        interactionId,
      ],
    );
    return mapOpening(result.rows[0]);
  },

  async addCard(
    database,
    { packOpeningId, cardPosition, cardTemplateId, cardInstanceId },
  ) {
    const result = await database.query(
      `
        INSERT INTO pack_opening_cards (
          pack_opening_id,
          card_position,
          card_template_id,
          card_instance_id
        ) VALUES ($1, $2, $3, $4)
        RETURNING
          pack_opening_id,
          card_position,
          card_template_id,
          card_instance_id,
          created_at
      `,
      [packOpeningId, cardPosition, cardTemplateId, cardInstanceId],
    );
    return mapOpeningCard(result.rows[0]);
  },

  async addCards(database, { packOpeningId, cards }) {
    if (!Array.isArray(cards) || cards.length === 0) return Object.freeze([]);
    const result = await database.query(
      `
        INSERT INTO pack_opening_cards (
          pack_opening_id,
          card_position,
          card_template_id,
          card_instance_id
        )
        SELECT $1, card_position, card_template_id, card_instance_id
        FROM UNNEST($2::SMALLINT[], $3::BIGINT[], $4::BIGINT[])
          AS card(card_position, card_template_id, card_instance_id)
        RETURNING
          pack_opening_id,
          card_position,
          card_template_id,
          card_instance_id,
          created_at
      `,
      [
        packOpeningId,
        cards.map((card) => card.cardPosition),
        cards.map((card) => card.cardTemplateId),
        cards.map((card) => card.cardInstanceId),
      ],
    );
    return Object.freeze(
      result.rows.map(mapOpeningCard).sort(
        (left, right) => left.cardPosition - right.cardPosition,
      ),
    );
  },

  async listCards(database, packOpeningId) {
    const result = await database.query(
      `
        SELECT
          pack_opening_id,
          card_position,
          card_template_id,
          card_instance_id,
          created_at
        FROM pack_opening_cards
        WHERE pack_opening_id = $1
        ORDER BY card_position
      `,
      [packOpeningId],
    );
    return result.rows.map(mapOpeningCard);
  },

  async complete(database, { packOpeningId, cardTemplateId, cardInstanceId }) {
    const result = await database.query(
      `
        UPDATE pack_openings
        SET status = 'COMPLETED', card_template_id = $2,
          card_instance_id = $3, completed_at = CURRENT_TIMESTAMP
        WHERE pack_opening_id = $1 AND status = 'OPEN'
        RETURNING ${OPENING_COLUMNS}
      `,
      [packOpeningId, cardTemplateId, cardInstanceId],
    );
    return mapOpening(result.rows[0]);
  },
});
