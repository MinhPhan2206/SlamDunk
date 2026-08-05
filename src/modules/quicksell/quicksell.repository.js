function mapCard(row) {
  if (!row) {
    return null;
  }

  return Object.freeze({
    cardInstanceId: row.card_instance_id,
    publicCardId: row.public_card_id,
    cardTemplateId: row.card_template_id,
    ownerPlayerId: row.owner_player_id,
    status: row.status,
    marketLock: row.market_lock,
    tradeLock: row.trade_lock,
    inLineup: row.in_lineup,
    playerName: row.player_name,
    edition: row.edition,
    rarityCode: row.rarity_code,
  });
}

export const quicksellRepository = Object.freeze({
  async findCardForUpdate(database, cardInstanceId) {
    const result = await database.query(
      `
        SELECT
          ci.card_instance_id,
          ci.public_card_id,
          ci.card_template_id,
          ci.owner_player_id,
          ci.status,
          ci.market_lock,
          ci.trade_lock,
          ct.player_name,
          ct.edition,
          r.rarity_code,
          EXISTS (
            SELECT 1
            FROM lineup_slots ls
            WHERE ls.card_instance_id = ci.card_instance_id
          ) AS in_lineup
        FROM card_instances ci
        JOIN card_templates ct
          ON ct.card_template_id = ci.card_template_id
        JOIN rarities r ON r.rarity_id = ct.rarity_id
        WHERE ci.card_instance_id = $1
        FOR UPDATE OF ci
      `,
      [cardInstanceId],
    );

    return mapCard(result.rows[0]);
  },

  async destroyCard(database, cardInstanceId) {
    await database.query(
      `
        UPDATE card_instances
        SET
          owner_player_id = NULL,
          status = 'DESTROYED_QUICKSELL',
          updated_at = CURRENT_TIMESTAMP
        WHERE card_instance_id = $1
      `,
      [cardInstanceId],
    );
  },

  async decrementCirculation(database, cardTemplateId) {
    const result = await database.query(
      `
        UPDATE card_mint_counters
        SET
          current_circulation = current_circulation - 1,
          updated_at = CURRENT_TIMESTAMP
        WHERE card_template_id = $1
          AND current_circulation > 0
        RETURNING current_circulation
      `,
      [cardTemplateId],
    );

    return result.rows[0]?.current_circulation ?? null;
  },

  async createOwnershipEvent(database, { cardInstanceId, playerId }) {
    await database.query(
      `
        INSERT INTO card_ownership_history (
          card_instance_id,
          from_player_id,
          to_player_id,
          reason,
          reference_type,
          reference_id
        )
        VALUES ($1, $2, NULL, 'QUICKSELL', 'CARD_INSTANCE', $1::BIGINT::TEXT)
      `,
      [cardInstanceId, playerId],
    );
  },
});
