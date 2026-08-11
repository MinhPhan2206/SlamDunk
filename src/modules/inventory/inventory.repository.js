function mapItem(row) {
  return Object.freeze({
    itemType: row.item_type,
    quantity: row.quantity,
  });
}

export const inventoryRepository = Object.freeze({
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
