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
});
