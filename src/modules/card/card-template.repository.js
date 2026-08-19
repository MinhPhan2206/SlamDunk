const CARD_TEMPLATE_COLUMNS = `
  card_template_id,
  player_name,
  primary_position,
  secondary_position,
  rarity_id,
  rarity_code,
  rarity_name,
  rarity_rank,
  overall,
  finishing,
  mid_range,
  three_point,
  playmaking,
  perimeter_defense,
  interior_defense,
  strength,
  height_cm,
  packable,
  retired_at,
  created_at,
  updated_at
`;

function mapCardTemplate(row) {
  if (!row) return null;

  return Object.freeze({
    cardTemplateId: row.card_template_id,
    playerName: row.player_name,
    primaryPosition: row.primary_position,
    secondaryPosition: row.secondary_position,
    rarityId: row.rarity_id,
    rarityCode: row.rarity_code,
    rarityName: row.rarity_name,
    rarityRank: row.rarity_rank,
    overall: row.overall,
    finishing: row.finishing,
    midRange: row.mid_range,
    threePoint: row.three_point,
    playmaking: row.playmaking,
    perimeterDefense: row.perimeter_defense,
    interiorDefense: row.interior_defense,
    strength: row.strength,
    heightCm: row.height_cm,
    packable: row.packable,
    retiredAt: row.retired_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

const JOINED_TEMPLATES = `
  SELECT ct.*, r.rarity_code, r.display_name AS rarity_name, r.rarity_rank
  FROM card_templates ct
  JOIN rarities r ON r.rarity_id = ct.rarity_id
`;

const RARITY_SORT_EXPRESSIONS = Object.freeze({
  alphabet: "player_name ASC, card_template_id ASC",
  finishing: "finishing DESC, player_name ASC, card_template_id ASC",
  mid_range: "mid_range DESC, player_name ASC, card_template_id ASC",
  three_point: "three_point DESC, player_name ASC, card_template_id ASC",
  playmaking: "playmaking DESC, player_name ASC, card_template_id ASC",
  interior_defense: "interior_defense DESC, player_name ASC, card_template_id ASC",
  perimeter_defense: "perimeter_defense DESC, player_name ASC, card_template_id ASC",
  strength: "strength DESC, player_name ASC, card_template_id ASC",
});

export const cardTemplateRepository = Object.freeze({
  async findPackable(database) {
    const result = await database.query(
      `
        SELECT ${CARD_TEMPLATE_COLUMNS}
        FROM (${JOINED_TEMPLATES}) card_templates
        WHERE packable = TRUE AND retired_at IS NULL
        ORDER BY rarity_rank, card_template_id
      `,
    );
    return result.rows.map(mapCardTemplate);
  },

  async findByRarityCode(
    database,
    { rarityCode, position, sortBy, limit, offset },
  ) {
    const orderBy = RARITY_SORT_EXPRESSIONS[sortBy];
    if (!orderBy) throw new TypeError("Unsupported Card Template sort.");
    const result = await database.query(
      `
        SELECT ${CARD_TEMPLATE_COLUMNS}, COUNT(*) OVER() AS total_count
        FROM (${JOINED_TEMPLATES}) card_templates
        WHERE rarity_code = $1
          AND (
            $2::TEXT IS NULL
            OR primary_position = $2
            OR secondary_position = $2
          )
        ORDER BY ${orderBy}
        LIMIT $3 OFFSET $4
      `,
      [rarityCode, position, limit, offset],
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
        FROM (${JOINED_TEMPLATES}) card_templates
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
          primary_position,
          secondary_position,
          rarity_id,
          overall,
          finishing,
          mid_range,
          three_point,
          playmaking,
          perimeter_defense,
          interior_defense,
          strength,
          height_cm,
          packable
        )
        VALUES (
          $1, $2, $3,
          (SELECT rarity_id FROM rarities WHERE rarity_code = $14),
          $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
        )
        RETURNING card_template_id
      `,
      [
        template.playerName,
        template.primaryPosition,
        template.secondaryPosition,
        template.overall,
        template.finishing,
        template.midRange,
        template.threePoint,
        template.playmaking,
        template.perimeterDefense,
        template.interiorDefense,
        template.strength,
        template.heightCm,
        template.packable,
        template.rarityCode,
      ],
    );
    return this.findById(database, result.rows[0].card_template_id);
  },

  async update(database, cardTemplateId, template) {
    await database.query(
      `
        UPDATE card_templates
        SET player_name = $1,
            primary_position = $2,
            secondary_position = $3,
            rarity_id = (SELECT rarity_id FROM rarities WHERE rarity_code = $14),
            overall = $4,
            finishing = $5,
            mid_range = $6,
            three_point = $7,
            playmaking = $8,
            perimeter_defense = $9,
            interior_defense = $10,
            strength = $11,
            height_cm = $12,
            packable = $13,
            updated_at = CURRENT_TIMESTAMP
        WHERE card_template_id = $15
      `,
      [
        template.playerName,
        template.primaryPosition,
        template.secondaryPosition,
        template.overall,
        template.finishing,
        template.midRange,
        template.threePoint,
        template.playmaking,
        template.perimeterDefense,
        template.interiorDefense,
        template.strength,
        template.heightCm,
        template.packable,
        template.rarityCode,
        cardTemplateId,
      ],
    );
    return this.findById(database, cardTemplateId);
  },

});
