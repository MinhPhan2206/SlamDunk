function mapOpening(row) {
  if (!row) return null;
  return Object.freeze({
    contractOpeningId: row.contract_opening_id,
    playerId: row.player_id,
    contractCode: row.contract_code,
    itemType: row.item_type,
    discordInteractionId: row.discord_interaction_id,
    cardTemplateId: row.card_template_id,
    cardInstanceId: row.card_instance_id,
    createdAt: row.created_at,
  });
}

export const contractRepository = Object.freeze({
  async findByInteractionId(database, interactionId) {
    const result = await database.query(
      `
        SELECT contract_opening_id, player_id, contract_code, item_type,
          discord_interaction_id, card_template_id, card_instance_id, created_at
        FROM contract_openings
        WHERE discord_interaction_id = $1
      `,
      [interactionId],
    );
    return mapOpening(result.rows[0]);
  },

  async create(database, input) {
    const result = await database.query(
      `
        INSERT INTO contract_openings (
          player_id, contract_code, item_type, discord_interaction_id,
          card_template_id, card_instance_id
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING contract_opening_id, player_id, contract_code, item_type,
          discord_interaction_id, card_template_id, card_instance_id, created_at
      `,
      [
        input.playerId,
        input.contractCode,
        input.itemType,
        input.interactionId,
        input.cardTemplateId,
        input.cardInstanceId,
      ],
    );
    return mapOpening(result.rows[0]);
  },
});
