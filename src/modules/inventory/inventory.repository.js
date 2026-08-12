function mapItem(row) {
  return Object.freeze({
    itemType: row.item_type,
    quantity: row.quantity,
  });
}

export const inventoryRepository = Object.freeze({
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

  async listPlayerItems(database, playerId) {
    const result = await database.query(
      `
        SELECT item_type, quantity
        FROM player_items
        WHERE player_id = $1
        ORDER BY item_type
      `,
      [playerId],
    );
    return result.rows.map(mapItem);
  },
});
