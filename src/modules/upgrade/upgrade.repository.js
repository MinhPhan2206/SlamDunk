function mapCard(row) {
  return Object.freeze({
    cardInstanceId: row.card_instance_id,
    publicCardId: row.public_card_id,
    cardTemplateId: row.card_template_id,
    ownerPlayerId: row.owner_player_id,
    serialNumber: row.serial_number,
    cardLevel: row.card_level,
    status: row.status,
    marketLock: row.market_lock,
    tradeLock: row.trade_lock,
    userLock: row.user_lock,
    inLineup: row.in_lineup,
    playerName: row.player_name,
    primaryPosition: row.primary_position,
    secondaryPosition: row.secondary_position,
    rarityCode: row.rarity_code,
    rarityName: row.rarity_name,
  });
}

export const upgradeRepository = Object.freeze({
  async listFusionGroups(database, playerId) {
    const result = await database.query(
      `
        SELECT
          ci.card_template_id,
          ct.player_name,
          ct.primary_position,
          ct.secondary_position,
          r.rarity_code,
          r.display_name AS rarity_name,
          r.rarity_rank,
          COUNT(*)::INTEGER AS card_count
        FROM card_instances ci
        JOIN card_templates ct ON ct.card_template_id = ci.card_template_id
        JOIN rarities r ON r.rarity_id = ct.rarity_id
        WHERE ci.owner_player_id = $1
          AND ci.status = 'ACTIVE'
          AND ci.market_lock = FALSE
          AND ci.trade_lock = FALSE
          AND NOT EXISTS (
            SELECT 1 FROM lineup_slots ls
            WHERE ls.card_instance_id = ci.card_instance_id
          )
        GROUP BY
          ci.card_template_id,
          ct.player_name,
          ct.primary_position,
          ct.secondary_position,
          r.rarity_code,
          r.display_name,
          r.rarity_rank
        HAVING COUNT(*) >= 2
        ORDER BY r.rarity_rank DESC, ct.player_name
      `,
      [playerId],
    );
    return result.rows.map((row) => Object.freeze({
      cardTemplateId: row.card_template_id,
      playerName: row.player_name,
      primaryPosition: row.primary_position,
      secondaryPosition: row.secondary_position,
      rarityCode: row.rarity_code,
      rarityName: row.rarity_name,
      rarityRank: row.rarity_rank,
      cardCount: row.card_count,
    }));
  },

  async listFusionCards(database, { playerId, cardTemplateId }) {
    const result = await database.query(
      `
        SELECT
          ci.card_instance_id,
          ci.public_card_id,
          ci.card_template_id,
          ci.owner_player_id,
          ci.serial_number,
          ci.card_level,
          ci.status,
          ci.market_lock,
          ci.trade_lock,
          ci.user_lock,
          ct.player_name,
          ct.primary_position,
          ct.secondary_position,
          r.rarity_code,
          r.display_name AS rarity_name,
          FALSE AS in_lineup
        FROM card_instances ci
        JOIN card_templates ct ON ct.card_template_id = ci.card_template_id
        JOIN rarities r ON r.rarity_id = ct.rarity_id
        WHERE ci.owner_player_id = $1
          AND ci.card_template_id = $2
          AND ci.status = 'ACTIVE'
          AND ci.market_lock = FALSE
          AND ci.trade_lock = FALSE
          AND NOT EXISTS (
            SELECT 1 FROM lineup_slots ls
            WHERE ls.card_instance_id = ci.card_instance_id
          )
        ORDER BY ci.card_level, ci.obtained_at, ci.card_instance_id
      `,
      [playerId, cardTemplateId],
    );
    return result.rows.map(mapCard);
  },

  async findCardsForUpdate(database, cardInstanceIds) {
    const result = await database.query(
      `
        SELECT
          ci.card_instance_id,
          ci.public_card_id,
          ci.card_template_id,
          ci.owner_player_id,
          ci.serial_number,
          ci.card_level,
          ci.status,
          ci.market_lock,
          ci.trade_lock,
          ci.user_lock,
          ct.player_name,
          ct.primary_position,
          ct.secondary_position,
          r.rarity_code,
          r.display_name AS rarity_name,
          EXISTS (
            SELECT 1 FROM lineup_slots ls
            WHERE ls.card_instance_id = ci.card_instance_id
          ) AS in_lineup
        FROM card_instances ci
        JOIN card_templates ct
          ON ct.card_template_id = ci.card_template_id
        JOIN rarities r ON r.rarity_id = ct.rarity_id
        WHERE ci.card_instance_id = ANY($1::BIGINT[])
        ORDER BY ci.card_instance_id
        FOR UPDATE OF ci
      `,
      [cardInstanceIds],
    );

    return result.rows.map(mapCard);
  },

  async findItemQuantity(database, { playerId, itemType }) {
    const result = await database.query(
      `
        SELECT quantity
        FROM player_items
        WHERE player_id = $1 AND item_type = $2
      `,
      [playerId, itemType],
    );
    return Number(result.rows[0]?.quantity ?? 0);
  },

  async destroyFusionSources(database, cardInstanceIds) {
    const result = await database.query(
      `
        UPDATE card_instances
        SET
          owner_player_id = NULL,
          status = 'DESTROYED_FUSION',
          updated_at = CURRENT_TIMESTAMP
        WHERE card_instance_id = ANY($1::BIGINT[])
        RETURNING card_instance_id
      `,
      [cardInstanceIds],
    );

    return result.rowCount;
  },

  async decrementCirculation(database, cardTemplateId, amount) {
    const result = await database.query(
      `
        UPDATE card_mint_counters
        SET
          current_circulation = current_circulation - $2,
          updated_at = CURRENT_TIMESTAMP
        WHERE card_template_id = $1
          AND current_circulation >= $2
        RETURNING current_circulation
      `,
      [cardTemplateId, amount],
    );

    return result.rows[0]?.current_circulation ?? null;
  },

  async createFusion(
    database,
    { playerId, resultCardInstanceId, resultLevel },
  ) {
    const result = await database.query(
      `
        INSERT INTO fusions (player_id, result_card_instance_id, result_level)
        VALUES ($1, $2, $3)
        RETURNING fusion_id, player_id, result_card_instance_id, result_level, created_at
      `,
      [playerId, resultCardInstanceId, resultLevel],
    );

    const row = result.rows[0];
    return Object.freeze({
      fusionId: row.fusion_id,
      playerId: row.player_id,
      resultCardInstanceId: row.result_card_instance_id,
      resultLevel: row.result_level,
      createdAt: row.created_at,
    });
  },

  async createFusionSources(database, fusionId, sourceCards) {
    await database.query(
      `
        INSERT INTO fusion_sources (
          fusion_id,
          source_card_instance_id,
          source_level
        )
        SELECT $1, source_card_instance_id, source_level
        FROM UNNEST($2::BIGINT[], $3::SMALLINT[])
          AS source(source_card_instance_id, source_level)
      `,
      [
        fusionId,
        sourceCards.map((card) => card.cardInstanceId),
        sourceCards.map((card) => card.cardLevel),
      ],
    );
  },

  async createFusionOwnershipEvents(
    database,
    { fusionId, playerId, sourceCards },
  ) {
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
        SELECT
          source_card_instance_id,
          $2,
          NULL,
          'FUSION',
          'FUSION',
          $3
        FROM UNNEST($1::BIGINT[]) AS source(source_card_instance_id)
      `,
      [
        sourceCards.map((card) => card.cardInstanceId),
        playerId,
        fusionId,
      ],
    );
  },

  async ensureItemRowForUpdate(database, { playerId, itemType }) {
    await database.query(
      `
        INSERT INTO player_items (player_id, item_type)
        VALUES ($1, $2)
        ON CONFLICT (player_id, item_type) DO NOTHING
      `,
      [playerId, itemType],
    );
    const result = await database.query(
      `
        SELECT quantity
        FROM player_items
        WHERE player_id = $1 AND item_type = $2
        FOR UPDATE
      `,
      [playerId, itemType],
    );

    return result.rows[0]?.quantity ?? 0;
  },

  async consumeItem(database, { playerId, itemType }) {
    const result = await database.query(
      `
        UPDATE player_items
        SET quantity = quantity - 1, updated_at = CURRENT_TIMESTAMP
        WHERE player_id = $1 AND item_type = $2 AND quantity > 0
        RETURNING quantity
      `,
      [playerId, itemType],
    );

    return result.rows[0]?.quantity ?? null;
  },

  async incrementCardLevel(database, cardInstanceId) {
    const result = await database.query(
      `
        UPDATE card_instances
        SET card_level = card_level + 1, updated_at = CURRENT_TIMESTAMP
        WHERE card_instance_id = $1 AND card_level < 5
        RETURNING card_level
      `,
      [cardInstanceId],
    );

    return result.rows[0]?.card_level ?? null;
  },

  async createUpgradeUsage(
    database,
    { playerId, cardInstanceId, previousLevel, newLevel, itemType },
  ) {
    await database.query(
      `
        INSERT INTO upgrade_item_usages (
          player_id,
          card_instance_id,
          previous_level,
          new_level,
          item_type
        )
        VALUES ($1, $2, $3, $4, $5)
      `,
      [playerId, cardInstanceId, previousLevel, newLevel, itemType],
    );
  },
});
