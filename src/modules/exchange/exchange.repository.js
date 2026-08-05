function mapExchange(row) {
  if (!row) return null;
  return Object.freeze({
    itemExchangeId: row.item_exchange_id,
    playerId: row.player_id,
    inputAmount: row.input_amount,
    outputItemType: row.output_item_type,
    outputQuantity: row.output_quantity,
    interactionId: row.discord_interaction_id,
  });
}

export const exchangeRepository = Object.freeze({
  async findByInteractionId(database, interactionId) {
    const result = await database.query(
      `SELECT * FROM item_exchanges WHERE discord_interaction_id = $1`,
      [interactionId],
    );
    return mapExchange(result.rows[0]);
  },
  async create(database, input) {
    const result = await database.query(
      `
        INSERT INTO item_exchanges (
          player_id, input_currency, input_amount, output_item_type,
          output_quantity, discord_interaction_id
        ) VALUES ($1, 'SHARDS', $2, $3, $4, $5)
        RETURNING *
      `,
      [input.playerId, input.inputAmount, input.outputItemType, input.outputQuantity, input.interactionId],
    );
    return mapExchange(result.rows[0]);
  },
  async grantItem(database, { playerId, itemType, quantity }) {
    const result = await database.query(
      `
        INSERT INTO player_items (player_id, item_type, quantity)
        VALUES ($1, $2, $3)
        ON CONFLICT (player_id, item_type) DO UPDATE
        SET quantity = player_items.quantity + EXCLUDED.quantity,
          updated_at = CURRENT_TIMESTAMP
        RETURNING quantity
      `,
      [playerId, itemType, quantity],
    );
    return result.rows[0].quantity;
  },
});
