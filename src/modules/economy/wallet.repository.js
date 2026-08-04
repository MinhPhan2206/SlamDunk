function mapWallet(row) {
  if (!row) {
    return null;
  }

  return Object.freeze({
    playerId: row.player_id,
    goldBalance: row.gold_balance,
    shardBalance: row.shard_balance,
    updatedAt: row.updated_at,
  });
}

const BALANCE_COLUMNS = Object.freeze({
  GOLD: "gold_balance",
  SHARDS: "shard_balance",
});

export const walletRepository = Object.freeze({
  async findByPlayerId(database, playerId) {
    const result = await database.query(
      `
        SELECT player_id, gold_balance, shard_balance, updated_at
        FROM wallets
        WHERE player_id = $1
      `,
      [playerId],
    );

    return mapWallet(result.rows[0]);
  },

  async createIfMissing(database, playerId) {
    await database.query(
      `
        INSERT INTO wallets (player_id)
        VALUES ($1)
        ON CONFLICT (player_id) DO NOTHING
      `,
      [playerId],
    );

    return walletRepository.findByPlayerId(database, playerId);
  },

  async findByPlayerIdsForUpdate(database, playerIds) {
    const result = await database.query(
      `
        SELECT player_id, gold_balance, shard_balance, updated_at
        FROM wallets
        WHERE player_id = ANY($1::BIGINT[])
        ORDER BY player_id
        FOR UPDATE
      `,
      [playerIds],
    );

    return result.rows.map(mapWallet);
  },

  async setBalance(database, { playerId, currency, balance }) {
    const balanceColumn = BALANCE_COLUMNS[currency];

    if (!balanceColumn) {
      throw new TypeError("currency must be GOLD or SHARDS.");
    }

    const result = await database.query(
      `
        UPDATE wallets
        SET ${balanceColumn} = $2, updated_at = CURRENT_TIMESTAMP
        WHERE player_id = $1
        RETURNING player_id, gold_balance, shard_balance, updated_at
      `,
      [playerId, balance],
    );

    return mapWallet(result.rows[0]);
  },
});
