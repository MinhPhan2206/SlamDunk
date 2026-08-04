function mapEconomyTransaction(row) {
  if (!row) {
    return null;
  }

  return Object.freeze({
    transactionId: row.transaction_id,
    playerId: row.player_id,
    currency: row.currency,
    amount: row.amount,
    transactionType: row.transaction_type,
    referenceType: row.reference_type,
    referenceId: row.reference_id,
    idempotencyKey: row.idempotency_key,
    balanceAfter: row.balance_after,
    createdAt: row.created_at,
  });
}

const ECONOMY_TRANSACTION_COLUMNS = `
  transaction_id,
  player_id,
  currency,
  amount,
  transaction_type,
  reference_type,
  reference_id,
  idempotency_key,
  balance_after,
  created_at
`;

export const economyTransactionRepository = Object.freeze({
  async findByIdempotencyKey(database, idempotencyKey) {
    const result = await database.query(
      `
        SELECT ${ECONOMY_TRANSACTION_COLUMNS}
        FROM economy_transactions
        WHERE idempotency_key = $1
      `,
      [idempotencyKey],
    );

    return mapEconomyTransaction(result.rows[0]);
  },

  async findByIdempotencyKeys(database, idempotencyKeys) {
    const result = await database.query(
      `
        SELECT ${ECONOMY_TRANSACTION_COLUMNS}
        FROM economy_transactions
        WHERE idempotency_key = ANY($1::TEXT[])
      `,
      [idempotencyKeys],
    );

    return result.rows.map(mapEconomyTransaction);
  },

  async create(
    database,
    {
      playerId,
      currency,
      amount,
      transactionType,
      referenceType,
      referenceId,
      idempotencyKey,
      balanceAfter,
    },
  ) {
    const result = await database.query(
      `
        INSERT INTO economy_transactions (
          player_id,
          currency,
          amount,
          transaction_type,
          reference_type,
          reference_id,
          idempotency_key,
          balance_after
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING ${ECONOMY_TRANSACTION_COLUMNS}
      `,
      [
        playerId,
        currency,
        amount,
        transactionType,
        referenceType,
        referenceId,
        idempotencyKey,
        balanceAfter,
      ],
    );

    return mapEconomyTransaction(result.rows[0]);
  },
});
