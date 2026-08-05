function mapOwnedCard(row) {
  return Object.freeze({
    cardInstanceId: row.card_instance_id,
    cardTemplateId: row.card_template_id,
    serialNumber: row.serial_number,
    cardLevel: row.card_level,
    obtainedAt: row.obtained_at,
    playerName: row.player_name,
    edition: row.edition,
    season: row.season,
    primaryPosition: row.primary_position,
    secondaryPosition: row.secondary_position,
    rarityCode: row.rarity_code,
    overall: row.overall,
  });
}

export const collectionRepository = Object.freeze({
  async listOwnedCards(
    database,
    { playerId, rarityCode, limit, offset },
  ) {
    const parameters = [playerId, rarityCode];
    const filter = `
      ci.owner_player_id = $1
      AND ci.status = 'ACTIVE'
      AND ($2::text IS NULL OR r.rarity_code = $2)
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
          ci.card_template_id,
          ci.serial_number,
          ci.card_level,
          ci.obtained_at,
          ct.player_name,
          ct.edition,
          ct.season,
          ct.primary_position,
          ct.secondary_position,
          r.rarity_code,
          ct.overall
        FROM card_instances ci
        JOIN card_templates ct
          ON ct.card_template_id = ci.card_template_id
        JOIN rarities r ON r.rarity_id = ct.rarity_id
        WHERE ${filter}
        ORDER BY ci.obtained_at DESC, ci.card_instance_id DESC
        LIMIT $3 OFFSET $4
      `,
      [...parameters, limit, offset],
    );

    return Object.freeze({
      cards: Object.freeze(cardsResult.rows.map(mapOwnedCard)),
      total: countResult.rows[0].total,
    });
  },
});
