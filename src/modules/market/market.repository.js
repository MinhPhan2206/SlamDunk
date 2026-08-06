function mapListing(row) {
  if (!row) {
    return null;
  }

  return Object.freeze({
    listingId: row.listing_id,
    sellerPlayerId: row.seller_player_id,
    cardInstanceId: row.card_instance_id,
    publicCardId: row.public_card_id,
    priceGold: row.price_gold,
    status: row.status,
    buyerPlayerId: row.buyer_player_id,
    createdAt: row.created_at,
    soldAt: row.sold_at,
    cancelledAt: row.cancelled_at,
    sellerName: row.seller_name,
    playerName: row.player_name,
    rarityCode: row.rarity_code,
    serialNumber: row.serial_number,
    cardLevel: row.card_level,
  });
}

const LISTING_COLUMNS = `
  listing_id,
  seller_player_id,
  card_instance_id,
  price_gold,
  status,
  buyer_player_id,
  created_at,
  sold_at,
  cancelled_at
`;

export const marketRepository = Object.freeze({
  async createListing(database, { sellerPlayerId, cardInstanceId, priceGold }) {
    const result = await database.query(
      `
        INSERT INTO market_listings (
          seller_player_id,
          card_instance_id,
          price_gold
        )
        VALUES ($1, $2, $3)
        RETURNING ${LISTING_COLUMNS}
      `,
      [sellerPlayerId, cardInstanceId, priceGold],
    );

    return mapListing(result.rows[0]);
  },

  async findByIdForUpdate(database, listingId) {
    const result = await database.query(
      `
        SELECT
          ml.listing_id,
          ml.seller_player_id,
          ml.card_instance_id,
          ci.public_card_id,
          ml.price_gold,
          ml.status,
          ml.buyer_player_id,
          ml.created_at,
          ml.sold_at,
          ml.cancelled_at,
          p.username_snapshot AS seller_name,
          ct.player_name,
          r.rarity_code,
          ci.serial_number,
          ci.card_level
        FROM market_listings ml
        JOIN players p ON p.player_id = ml.seller_player_id
        JOIN card_instances ci ON ci.card_instance_id = ml.card_instance_id
        JOIN card_templates ct ON ct.card_template_id = ci.card_template_id
        JOIN rarities r ON r.rarity_id = ct.rarity_id
        WHERE ml.listing_id = $1
        FOR UPDATE OF ml
      `,
      [listingId],
    );

    return mapListing(result.rows[0]);
  },

  async listActive(database, { limit, offset }) {
    const countResult = await database.query(
      `SELECT COUNT(*) AS total FROM market_listings WHERE status = 'ACTIVE'`,
    );
    const result = await database.query(
      `
        SELECT
          ml.listing_id,
          ml.seller_player_id,
          ml.card_instance_id,
          ci.public_card_id,
          ml.price_gold,
          ml.status,
          ml.buyer_player_id,
          ml.created_at,
          ml.sold_at,
          ml.cancelled_at,
          p.username_snapshot AS seller_name,
          ct.player_name,
          r.rarity_code,
          ci.serial_number,
          ci.card_level
        FROM market_listings ml
        JOIN players p ON p.player_id = ml.seller_player_id
        JOIN card_instances ci ON ci.card_instance_id = ml.card_instance_id
        JOIN card_templates ct ON ct.card_template_id = ci.card_template_id
        JOIN rarities r ON r.rarity_id = ct.rarity_id
        WHERE ml.status = 'ACTIVE'
        ORDER BY ml.created_at DESC, ml.listing_id DESC
        LIMIT $1 OFFSET $2
      `,
      [limit, offset],
    );

    return Object.freeze({
      listings: result.rows.map(mapListing),
      total: countResult.rows[0].total,
    });
  },

  async markCancelled(database, listingId) {
    const result = await database.query(
      `
        UPDATE market_listings
        SET status = 'CANCELLED', cancelled_at = CURRENT_TIMESTAMP
        WHERE listing_id = $1 AND status = 'ACTIVE'
        RETURNING ${LISTING_COLUMNS}
      `,
      [listingId],
    );

    return mapListing(result.rows[0]);
  },

  async markSold(database, { listingId, buyerPlayerId }) {
    const result = await database.query(
      `
        UPDATE market_listings
        SET
          status = 'SOLD',
          buyer_player_id = $2,
          sold_at = CURRENT_TIMESTAMP
        WHERE listing_id = $1 AND status = 'ACTIVE'
        RETURNING ${LISTING_COLUMNS}
      `,
      [listingId, buyerPlayerId],
    );

    return mapListing(result.rows[0]);
  },
});
