import { getDatabaseConfig } from "../src/config/env.js";
import { createPostgresPool } from "../src/database/connection/postgres.js";
import { withTransaction } from "../src/database/transaction/transaction-manager.js";

const CURRENCIES = Object.freeze({
  GOLD: "gold_balance",
  SHARDS: "shard_balance",
});

function positiveAmount(value, name) {
  const amount = BigInt(value ?? "");
  if (amount <= 0n) throw new Error(`${name} must be a positive integer.`);
  return amount.toString();
}

function parseArguments() {
  const [goldText, shardsText, batchIdText] = process.argv.slice(2);
  const batchId = batchIdText?.trim();
  if (!batchId || !/^[a-z0-9][a-z0-9_-]{2,63}$/i.test(batchId)) {
    throw new Error("batch_id must contain 3-64 letters, numbers, underscores, or hyphens.");
  }
  return {
    gold: positiveAmount(goldText, "gold"),
    shards: positiveAmount(shardsText, "shards"),
    batchId,
  };
}

async function creditCurrency(database, { currency, amount, batchId }) {
  const balanceColumn = CURRENCIES[currency];
  const keyPrefix = `admin-resource-grant:${batchId}:${currency.toLowerCase()}:player:`;
  return database.query(
    `
      WITH eligible AS (
        SELECT w.player_id
        FROM wallets w
        WHERE NOT EXISTS (
          SELECT 1
          FROM economy_transactions et
          WHERE et.idempotency_key = $2 || w.player_id
        )
      ), credited AS (
        UPDATE wallets w
        SET
          ${balanceColumn} = w.${balanceColumn} + $1::BIGINT,
          updated_at = CURRENT_TIMESTAMP
        FROM eligible e
        WHERE w.player_id = e.player_id
        RETURNING w.player_id, w.${balanceColumn} AS balance_after
      )
      INSERT INTO economy_transactions (
        player_id, currency, amount, transaction_type,
        reference_type, reference_id, idempotency_key, balance_after
      )
      SELECT
        player_id, $3, $1::BIGINT, 'ADMIN_GRANT',
        'ADMIN_BATCH', $4, $2 || player_id, balance_after
      FROM credited
      RETURNING player_id
    `,
    [amount, keyPrefix, currency, batchId],
  );
}

async function grantResourcesToAll() {
  const { gold, shards, batchId } = parseArguments();
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
      const goldResult = await creditCurrency(database, {
        currency: "GOLD",
        amount: gold,
        batchId,
      });
      const shardResult = await creditCurrency(database, {
        currency: "SHARDS",
        amount: shards,
        batchId,
      });
      return { goldCount: goldResult.rowCount, shardCount: shardResult.rowCount };
    });

    console.log(
      `Granted ${gold} Gold to ${result.goldCount} player(s) and ` +
      `${shards} Shards to ${result.shardCount} player(s).`,
    );
  } finally {
    await pool.end();
  }
}

grantResourcesToAll().catch((error) => {
  console.error(`Bulk resource grant failed: ${error.message}`);
  process.exitCode = 1;
});
