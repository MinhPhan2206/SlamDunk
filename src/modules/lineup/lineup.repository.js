function mapLineup(row) {
  return Object.freeze({
    lineupId: row.lineup_id,
    playerId: row.player_id,
    name: row.name,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function mapSlot(row) {
  return Object.freeze({
    slot: row.slot,
    cardInstanceId: row.card_instance_id,
    serialNumber: row.serial_number,
    cardLevel: row.card_level,
    playerName: row.player_name,
    edition: row.edition,
    rarityTier: row.rarity_tier,
    overall: row.overall,
    primaryPosition: row.primary_position,
    secondaryPosition: row.secondary_position,
  });
}

export const lineupRepository = Object.freeze({
  async getOrCreate(database, playerId) {
    const result = await database.query(
      `
        INSERT INTO lineups (player_id)
        VALUES ($1)
        ON CONFLICT (player_id) DO UPDATE
          SET player_id = EXCLUDED.player_id
        RETURNING lineup_id, player_id, name, is_active, created_at, updated_at
      `,
      [playerId],
    );

    return mapLineup(result.rows[0]);
  },

  async findSlots(database, lineupId) {
    const result = await database.query(
      `
        SELECT
          ls.slot,
          ci.card_instance_id,
          ci.serial_number,
          ci.card_level,
          ct.player_name,
          ct.edition,
          ct.rarity_tier,
          ct.overall,
          ct.primary_position,
          ct.secondary_position
        FROM lineup_slots ls
        JOIN card_instances ci
          ON ci.card_instance_id = ls.card_instance_id
        JOIN card_templates ct
          ON ct.card_template_id = ci.card_template_id
        WHERE ls.lineup_id = $1
      `,
      [lineupId],
    );

    return result.rows.map(mapSlot);
  },

  async findCardForUpdate(database, cardInstanceId) {
    const result = await database.query(
      `
        SELECT
          ci.card_instance_id,
          ci.owner_player_id,
          ci.status,
          ct.primary_position,
          ct.secondary_position
        FROM card_instances ci
        JOIN card_templates ct
          ON ct.card_template_id = ci.card_template_id
        WHERE ci.card_instance_id = $1
        FOR UPDATE OF ci
      `,
      [cardInstanceId],
    );

    return result.rows[0] ?? null;
  },

  async findSlotByCard(database, { lineupId, cardInstanceId }) {
    const result = await database.query(
      `
        SELECT slot
        FROM lineup_slots
        WHERE lineup_id = $1 AND card_instance_id = $2
      `,
      [lineupId, cardInstanceId],
    );

    return result.rows[0]?.slot ?? null;
  },

  async setSlot(database, { lineupId, slot, cardInstanceId }) {
    await database.query(
      `
        INSERT INTO lineup_slots (lineup_id, slot, card_instance_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (lineup_id, slot) DO UPDATE
          SET
            card_instance_id = EXCLUDED.card_instance_id,
            updated_at = CURRENT_TIMESTAMP
      `,
      [lineupId, slot, cardInstanceId],
    );
    await database.query(
      `UPDATE lineups SET updated_at = CURRENT_TIMESTAMP WHERE lineup_id = $1`,
      [lineupId],
    );
  },

  async removeSlot(database, { lineupId, slot }) {
    await database.query(
      `DELETE FROM lineup_slots WHERE lineup_id = $1 AND slot = $2`,
      [lineupId, slot],
    );
    await database.query(
      `UPDATE lineups SET updated_at = CURRENT_TIMESTAMP WHERE lineup_id = $1`,
      [lineupId],
    );
  },
});
