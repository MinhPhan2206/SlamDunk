function mapOwnedCard(row) {
  return Object.freeze({
    cardInstanceId: row.card_instance_id,
    publicCardId: row.public_card_id,
    collectionPosition: Number(row.collection_position),
    cardTemplateId: row.card_template_id,
    serialNumber: row.serial_number,
    cardLevel: row.card_level,
    userLock: row.user_lock,
    obtainedAt: row.obtained_at,
    playerName: row.player_name,
    primaryPosition: row.primary_position,
    secondaryPosition: row.secondary_position,
    rarityCode: row.rarity_code,
  });
}

export const collectionRepository = Object.freeze({
  async getSortKey(database, playerId) {
    const result = await database.query(
      `SELECT sort_key FROM player_collection_preferences WHERE player_id = $1`,
      [playerId],
    );
    return result.rows[0]?.sort_key ?? null;
  },

  async setSortKey(database, { playerId, sortKey }) {
    const result = await database.query(
      `
        INSERT INTO player_collection_preferences (player_id, sort_key)
        VALUES ($1, $2)
        ON CONFLICT (player_id) DO UPDATE
          SET sort_key = EXCLUDED.sort_key, updated_at = CURRENT_TIMESTAMP
        RETURNING sort_key, updated_at
      `,
      [playerId, sortKey],
    );
    return Object.freeze({
      sortKey: result.rows[0].sort_key,
      updatedAt: result.rows[0].updated_at,
    });
  },

  async resolveOwnedReference(
    database,
    { playerId, cardReference, sortKey },
  ) {
    const { orderBy } = getCollectionSortDefinition(sortKey);
    const result = await database.query(
      `
        WITH ordered_cards AS (
          SELECT
            ci.card_instance_id,
            ci.public_card_id,
            ROW_NUMBER() OVER (ORDER BY ${orderBy}) AS collection_position
          FROM card_instances ci
          JOIN card_templates ct ON ct.card_template_id = ci.card_template_id
          JOIN rarities r ON r.rarity_id = ct.rarity_id
          WHERE ci.owner_player_id = $1 AND ci.status = 'ACTIVE'
        )
        SELECT card_instance_id
        FROM ordered_cards
        WHERE
          ($2::BIGINT >= 100000000 AND public_card_id = $2)
          OR
          ($2::BIGINT < 100000000 AND collection_position = $2)
      `,
      [playerId, cardReference],
    );
    return result.rows[0]?.card_instance_id ?? null;
  },

  async listOwnedCards(
    database,
    { playerId, sortKey, limit, offset },
  ) {
    const { orderBy } = getCollectionSortDefinition(sortKey);
    const parameters = [playerId];
    const filter = `
      ci.owner_player_id = $1
      AND ci.status = 'ACTIVE'
    `;
    const countResult = await database.query(
      `
        SELECT COUNT(*) AS total
        FROM card_instances ci
        JOIN card_templates ct
          ON ct.card_template_id = ci.card_template_id
        JOIN rarities r ON r.rarity_id = ct.rarity_id
        WHERE ${filter}
      `,
      parameters,
    );
    const cardsResult = await database.query(
      `
        SELECT
          ci.card_instance_id,
          ci.public_card_id,
          ROW_NUMBER() OVER (
            ORDER BY ${orderBy}
          ) AS collection_position,
          ci.card_template_id,
          ci.serial_number,
          ci.card_level,
          ci.user_lock,
          ci.obtained_at,
          ct.player_name,
          ct.primary_position,
          ct.secondary_position,
          r.rarity_code
        FROM card_instances ci
        JOIN card_templates ct
          ON ct.card_template_id = ci.card_template_id
        JOIN rarities r ON r.rarity_id = ct.rarity_id
        WHERE ${filter}
        ORDER BY ${orderBy}
        LIMIT $2 OFFSET $3
      `,
      [...parameters, limit, offset],
    );

    return Object.freeze({
      cards: Object.freeze(cardsResult.rows.map(mapOwnedCard)),
      total: countResult.rows[0].total,
    });
  },
});
import { getCollectionSortDefinition } from "./collection-sort.js";
