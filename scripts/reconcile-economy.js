import { getDatabaseConfig } from "../src/config/env.js";
import { createPostgresPool } from "../src/database/connection/postgres.js";

async function main() {
  const pool = createPostgresPool({
    connectionString: getDatabaseConfig().databaseUrl,
  });
  try {
    const [wallets, cardLocks, expiredEscrows] = await Promise.all([
      pool.query(`
        WITH latest AS (
          SELECT DISTINCT ON (player_id, currency)
            player_id, currency, balance_after
          FROM economy_transactions
          ORDER BY player_id, currency, transaction_id DESC
        )
        SELECT w.player_id, w.gold_balance, w.shard_balance,
          COALESCE(g.balance_after, 0) AS ledger_gold,
          COALESCE(s.balance_after, 0) AS ledger_shards
        FROM wallets w
        LEFT JOIN latest g ON g.player_id = w.player_id AND g.currency = 'GOLD'
        LEFT JOIN latest s ON s.player_id = w.player_id AND s.currency = 'SHARDS'
        WHERE w.gold_balance <> COALESCE(g.balance_after, 0)
           OR w.shard_balance <> COALESCE(s.balance_after, 0)
      `),
      pool.query(`
        SELECT card_instance_id
        FROM card_instances
        WHERE (market_lock AND trade_lock)
           OR (status <> 'ACTIVE' AND (market_lock OR trade_lock))
      `),
      pool.query(`
        SELECT public_duel_id
        FROM duel_challenges
        WHERE status = 'PENDING' AND expires_at < CURRENT_TIMESTAMP
      `),
    ]);
    const issues = wallets.rowCount + cardLocks.rowCount + expiredEscrows.rowCount;
    console.log(JSON.stringify({
      event: "ECONOMY_RECONCILIATION",
      issues,
      walletMismatches: wallets.rowCount,
      invalidCardLocks: cardLocks.rowCount,
      expiredPendingDuels: expiredEscrows.rowCount,
    }));
    if (issues > 0) process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`Economy reconciliation failed: ${error.message}`);
  process.exitCode = 1;
});

