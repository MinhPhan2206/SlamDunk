import { getDatabaseConfig } from "../src/config/env.js";
import { createPostgresPool } from "../src/database/connection/postgres.js";
import { withTransaction } from "../src/database/transaction/transaction-manager.js";

function parseArguments() {
  const [amountText, batchIdText] = process.argv.slice(2);
  const amount = BigInt(amountText ?? "");
  const batchId = batchIdText?.trim();

  if (amount <= 0n) throw new Error("amount must be a positive integer.");
  if (!batchId || !/^[a-z0-9][a-z0-9_-]{2,63}$/i.test(batchId)) {
    throw new Error("batch_id must contain 3-64 letters, numbers, underscores, or hyphens.");
  }
  return { amount: amount.toString(), batchId };
}

async function grantGoldToAll() {
  const { amount, batchId } = parseArguments();
  const pool = createPostgresPool({
    connectionString: getDatabaseConfig().databaseUrl,
  });

  try {
    const result = await withTransaction(pool, async (database) => {
      await database.query(`
        INSERT INTO wallets (player_id)
        SELECT player_id FROM players
        ON CONFLICT (player_id) DO NOTHING
      `);

      return database.query(
        `
          WITH eligible AS (
            SELECT w.player_id
            FROM wallets w
            WHERE NOT EXISTS (
              SELECT 1
              FROM economy_transactions et
              WHERE et.idempotency_key =
                'admin-gold-grant:' || $2 || ':player:' || w.player_id
            )
          ), credited AS (
            UPDATE wallets w
            SET
              gold_balance = w.gold_balance + $1::BIGINT,
              updated_at = CURRENT_TIMESTAMP
            FROM eligible e
            WHERE w.player_id = e.player_id
            RETURNING w.player_id, w.gold_balance
          )
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
          SELECT
            player_id,
            'GOLD',
            $1::BIGINT,
            'ADMIN_GRANT',
            'ADMIN_BATCH',
            $2,
            'admin-gold-grant:' || $2 || ':player:' || player_id,
            gold_balance
          FROM credited
          RETURNING player_id
        `,
        [amount, batchId],
      );
    });

    console.log(`Granted ${amount} Gold to ${result.rowCount} player(s).`);
  } finally {
    await pool.end();
  }
}

grantGoldToAll().catch((error) => {
  console.error(`Bulk Gold grant failed: ${error.message}`);
  process.exitCode = 1;
});
