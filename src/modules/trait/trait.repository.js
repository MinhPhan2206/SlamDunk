const TRAIT_DEFINITION_COLUMNS = `
  trait_id,
  trait_code,
  trait_name,
  trait_type,
  description,
  active,
  created_at,
  updated_at
`;

function mapTraitDefinition(row) {
  if (!row) {
    return null;
  }

  return Object.freeze({
    traitId: row.trait_id,
    traitCode: row.trait_code,
    traitName: row.trait_name,
    traitType: row.trait_type,
    description: row.description,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function mapTemplateTrait(row) {
  if (!row) {
    return null;
  }

  return Object.freeze({
    cardTemplateId: row.card_template_id,
    traitId: row.trait_id,
    traitCode: row.trait_code,
    traitName: row.trait_name,
    traitType: row.trait_type,
    description: row.description,
    traitTier: row.trait_tier,
    traitTierLabel: ["I", "II", "III"][row.trait_tier - 1],
    active: row.active,
    assignedAt: row.created_at,
  });
}

export const traitRepository = Object.freeze({
  async createDefinition(database, definition) {
    const result = await database.query(
      `
        INSERT INTO trait_definitions (
          trait_code,
          trait_name,
          trait_type,
          description,
          active
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING ${TRAIT_DEFINITION_COLUMNS}
      `,
      [
        definition.traitCode,
        definition.traitName,
        definition.traitType,
        definition.description,
        definition.active,
      ],
    );

    return mapTraitDefinition(result.rows[0]);
  },

  async findDefinitionById(database, traitId) {
    const result = await database.query(
      `
        SELECT ${TRAIT_DEFINITION_COLUMNS}
        FROM trait_definitions
        WHERE trait_id = $1
      `,
      [traitId],
    );

    return mapTraitDefinition(result.rows[0]);
  },

  async findDefinitionByCode(database, traitCode) {
    const result = await database.query(
      `
        SELECT ${TRAIT_DEFINITION_COLUMNS}
        FROM trait_definitions
        WHERE trait_code = $1
      `,
      [traitCode],
    );

    return mapTraitDefinition(result.rows[0]);
  },

  async findAssignment(database, { cardTemplateId, traitId }) {
    const result = await database.query(
      `
        SELECT
          ctt.card_template_id,
          td.trait_id,
          td.trait_code,
          td.trait_name,
          td.trait_type,
          td.description,
          ctt.trait_tier,
          td.active,
          ctt.created_at
        FROM card_template_traits ctt
        JOIN trait_definitions td ON td.trait_id = ctt.trait_id
        WHERE ctt.card_template_id = $1 AND ctt.trait_id = $2
      `,
      [cardTemplateId, traitId],
    );

    return mapTemplateTrait(result.rows[0]);
  },

  async createAssignment(database, { cardTemplateId, traitId, traitTier }) {
    await database.query(
      `
        INSERT INTO card_template_traits (
          card_template_id,
          trait_id,
          trait_tier
        )
        VALUES ($1, $2, $3)
      `,
      [cardTemplateId, traitId, traitTier],
    );

    return traitRepository.findAssignment(database, {
      cardTemplateId,
      traitId,
    });
  },

  async findByCardTemplateId(database, cardTemplateId) {
    const result = await database.query(
      `
        SELECT
          ctt.card_template_id,
          td.trait_id,
          td.trait_code,
          td.trait_name,
          td.trait_type,
          td.description,
          ctt.trait_tier,
          td.active,
          ctt.created_at
        FROM card_template_traits ctt
        JOIN trait_definitions td ON td.trait_id = ctt.trait_id
        WHERE ctt.card_template_id = $1
        ORDER BY td.trait_code
      `,
      [cardTemplateId],
    );

    return result.rows.map(mapTemplateTrait);
  },
});
