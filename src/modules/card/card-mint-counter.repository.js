function mapMintCounter(row) {
  if (!row) {
    return null;
  }

  return Object.freeze({
    cardTemplateId: row.card_template_id,
    lastSerialNumber: row.last_serial_number,
    totalMinted: row.total_minted,
    currentCirculation: row.current_circulation,
    updatedAt: row.updated_at,
  });
}

export const cardMintCounterRepository = Object.freeze({
  async allocateNextSerial(database, cardTemplateId) {
    await database.query(
      `
        INSERT INTO card_mint_counters (card_template_id)
        VALUES ($1)
        ON CONFLICT (card_template_id) DO NOTHING
      `,
      [cardTemplateId],
    );

    const result = await database.query(
      `
        UPDATE card_mint_counters
        SET
          last_serial_number = last_serial_number + 1,
          total_minted = total_minted + 1,
          current_circulation = current_circulation + 1,
          updated_at = CURRENT_TIMESTAMP
        WHERE card_template_id = $1
        RETURNING
          card_template_id,
          last_serial_number,
          total_minted,
          current_circulation,
          updated_at
      `,
      [cardTemplateId],
    );

    return mapMintCounter(result.rows[0]);
  },

  async findByCardTemplateId(database, cardTemplateId) {
    const result = await database.query(
      `
        SELECT
          card_template_id,
          last_serial_number,
          total_minted,
          current_circulation,
          updated_at
        FROM card_mint_counters
        WHERE card_template_id = $1
      `,
      [cardTemplateId],
    );

    return mapMintCounter(result.rows[0]);
  },
});
