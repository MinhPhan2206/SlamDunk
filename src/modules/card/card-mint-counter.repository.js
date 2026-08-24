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
  async allocateSerialRange(database, cardTemplateId, quantity) {
    const result = await database.query(
      `
        INSERT INTO card_mint_counters (
          card_template_id,
          last_serial_number,
          total_minted,
          current_circulation
        )
        VALUES ($1, $2, $2, $2)
        ON CONFLICT (card_template_id) DO UPDATE SET
          last_serial_number = card_mint_counters.last_serial_number + $2,
          total_minted = card_mint_counters.total_minted + $2,
          current_circulation = card_mint_counters.current_circulation + $2,
          updated_at = CURRENT_TIMESTAMP
        RETURNING
          card_template_id,
          last_serial_number,
          total_minted,
          current_circulation,
          updated_at
      `,
      [cardTemplateId, quantity],
    );
    return mapMintCounter(result.rows[0]);
  },

  async allocateNextSerial(database, cardTemplateId) {
    const result = await database.query(
      `
        INSERT INTO card_mint_counters (
          card_template_id,
          last_serial_number,
          total_minted,
          current_circulation
        )
        VALUES ($1, 1, 1, 1)
        ON CONFLICT (card_template_id) DO UPDATE SET
          last_serial_number = card_mint_counters.last_serial_number + 1,
          total_minted = card_mint_counters.total_minted + 1,
          current_circulation = card_mint_counters.current_circulation + 1,
          updated_at = CURRENT_TIMESTAMP
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
