import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { getTestDatabaseConfig } from "../src/config/env.js";
import { createPostgresPool } from "../src/database/connection/postgres.js";
import { assertSchemaCurrent } from "../src/database/migrations/migration-runner.js";

const migrationsDirectory = fileURLToPath(new URL("../migrations/", import.meta.url));

async function assertImmutable(database, statement) {
  await database.query("SAVEPOINT immutable_check");
  await assert.rejects(
    database.query(statement),
    (error) => error?.code === "55000",
  );
  await database.query("ROLLBACK TO SAVEPOINT immutable_check");
}

test("schema is current and Item, XP, ownership, and security audits are immutable", async () => {
  const pool = createPostgresPool({
    connectionString: getTestDatabaseConfig().databaseUrl,
  });
  const database = await pool.connect();
  try {
    await assertSchemaCurrent(pool, migrationsDirectory);
    await database.query("BEGIN");
    const player = await database.query(`
      INSERT INTO players (discord_user_id, username_snapshot)
      VALUES ('990000000000000001', 'AuditTest')
      RETURNING player_id
    `);
    const playerId = player.rows[0].player_id;

    await database.query(
      "INSERT INTO player_items (player_id, item_type, quantity) VALUES ($1, 'LEVEL_UP', 2)",
      [playerId],
    );
    await database.query(
      "UPDATE player_items SET quantity = 1 WHERE player_id = $1 AND item_type = 'LEVEL_UP'",
      [playerId],
    );
    const itemAudit = await database.query(
      `SELECT item_transaction_id, amount, balance_after FROM item_transactions
       WHERE player_id = $1 ORDER BY item_transaction_id`,
      [playerId],
    );
    assert.deepEqual(itemAudit.rows.map(({ amount, balance_after }) => ({
      amount,
      balance_after,
    })), [
      { amount: 2, balance_after: 2 },
      { amount: -1, balance_after: 1 },
    ]);

    const xp = await database.query(
      `INSERT INTO player_xp_transactions (
         player_id, amount, source_type, reference_id, idempotency_key,
         xp_after, player_level_after
       ) VALUES ($1, 50, 'TEST', 'audit', $2, 50, 0)
       RETURNING xp_transaction_id`,
      [playerId, `audit-xp-${Date.now()}`],
    );
    const security = await database.query(
      `INSERT INTO security_events (event_type, severity)
       VALUES ('AUDIT_TEST', 'INFO') RETURNING security_event_id`,
    );

    await assertImmutable(
      database,
      `UPDATE item_transactions SET amount = 99
       WHERE item_transaction_id = ${itemAudit.rows[0].item_transaction_id}`,
    );
    await assertImmutable(
      database,
      `DELETE FROM player_xp_transactions WHERE xp_transaction_id = ${xp.rows[0].xp_transaction_id}`,
    );
    await assertImmutable(
      database,
      `DELETE FROM security_events WHERE security_event_id = ${security.rows[0].security_event_id}`,
    );

    const ownershipTrigger = await database.query(`
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'card_ownership_history_immutable' AND NOT tgisinternal
    `);
    assert.equal(ownershipTrigger.rowCount, 1);
    await database.query("ROLLBACK");
  } finally {
    await database.query("ROLLBACK").catch(() => {});
    database.release();
    await pool.end();
  }
});
