const CARD_TEMPLATE_COLUMNS = `
  card_template_id,
  player_name,
  edition,
  season,
  primary_position,
  secondary_position,
  rarity_tier,
  overall,
  inside_scoring,
  mid_range,
  three_point,
  playmaking,
  perimeter_defense,
  interior_defense,
  rebounding,
  athleticism,
  height_cm,
  weight_kg,
  packable,
  release_date,
  retired_at,
  created_at,
  updated_at
`;

function mapCardTemplate(row) {
  if (!row) {
    return null;
  }

  return Object.freeze({
    cardTemplateId: row.card_template_id,
    playerName: row.player_name,
    edition: row.edition,
    season: row.season,
    primaryPosition: row.primary_position,
    secondaryPosition: row.secondary_position,
    rarityTier: row.rarity_tier,
    overall: row.overall,
    insideScoring: row.inside_scoring,
    midRange: row.mid_range,
    threePoint: row.three_point,
    playmaking: row.playmaking,
    perimeterDefense: row.perimeter_defense,
    interiorDefense: row.interior_defense,
    rebounding: row.rebounding,
    athleticism: row.athleticism,
    heightCm: row.height_cm,
    weightKg: row.weight_kg,
    packable: row.packable,
    releaseDate: row.release_date,
    retiredAt: row.retired_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export const cardTemplateRepository = Object.freeze({
  async findByRarityTier(database, rarityTier, limit) {
    const result = await database.query(
      `
        SELECT ${CARD_TEMPLATE_COLUMNS}, COUNT(*) OVER() AS total_count
        FROM card_templates
        WHERE rarity_tier = $1
        ORDER BY overall DESC, player_name, edition, card_template_id
        LIMIT $2
      `,
      [rarityTier, limit],
    );

    return Object.freeze({
      templates: result.rows.map(mapCardTemplate),
      total: result.rows[0]?.total_count ?? "0",
    });
  },

  async findById(database, cardTemplateId) {
    const result = await database.query(
      `
        SELECT ${CARD_TEMPLATE_COLUMNS}
        FROM card_templates
        WHERE card_template_id = $1
      `,
      [cardTemplateId],
    );

    return mapCardTemplate(result.rows[0]);
  },

  async create(database, template) {
    const result = await database.query(
      `
        INSERT INTO card_templates (
          player_name,
          edition,
          season,
          primary_position,
          secondary_position,
          rarity_tier,
          overall,
          inside_scoring,
          mid_range,
          three_point,
          playmaking,
          perimeter_defense,
          interior_defense,
          rebounding,
          athleticism,
          height_cm,
          weight_kg,
          packable,
          release_date
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19
        )
        RETURNING ${CARD_TEMPLATE_COLUMNS}
      `,
      [
        template.playerName,
        template.edition,
        template.season,
        template.primaryPosition,
        template.secondaryPosition,
        template.rarityTier,
        template.overall,
        template.insideScoring,
        template.midRange,
        template.threePoint,
        template.playmaking,
        template.perimeterDefense,
        template.interiorDefense,
        template.rebounding,
        template.athleticism,
        template.heightCm,
        template.weightKg,
        template.packable,
        template.releaseDate,
      ],
    );

    return mapCardTemplate(result.rows[0]);
  },
});
