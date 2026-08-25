import assert from "node:assert/strict";
import test from "node:test";

import { getTestDatabaseConfig } from "../src/config/env.js";
import { createPostgresPool } from "../src/database/connection/postgres.js";
import {
  EconomyCurrency,
  EconomyError,
  createEconomyService,
} from "../src/modules/economy/index.js";

test("economy movements update wallets and create an immutable ledger", async () => {
  const pool = createPostgresPool({
    connectionString: getTestDatabaseConfig().databaseUrl,
  });
  const database = await pool.connect();
  const economyService = createEconomyService({ databasePool: pool });
  const testRunId = Date.now().toString();

  try {
    await database.query("BEGIN");

    const players = await database.query(
      `
        INSERT INTO players (discord_user_id, username_snapshot)
        VALUES ($1, 'M5LedgerSource'), ($2, 'M5LedgerDestination')
        RETURNING player_id
      `,
      [`997${testRunId}`, `998${testRunId}`],
    );
    const sourcePlayerId = players.rows[0].player_id;
    const destinationPlayerId = players.rows[1].player_id;

    await database.query(
      "INSERT INTO wallets (player_id) VALUES ($1), ($2)",
      [sourcePlayerId, destinationPlayerId],
    );

    const creditInput = {
      playerId: sourcePlayerId,
      currency: EconomyCurrency.GOLD,
      amount: 100,
      transactionType: "ADMIN_ADJUSTMENT",
      referenceType: "M5_TEST",
      referenceId: testRunId,
      idempotencyKey: `m5:${testRunId}:credit`,
    };
    const credit = await economyService.credit(creditInput, { database });
    const replayedCredit = await economyService.credit(creditInput, { database });

    assert.equal(credit.balanceAfter, "100");
    assert.equal(credit.replayed, false);
    assert.equal(replayedCredit.balanceAfter, "100");
    assert.equal(replayedCredit.replayed, true);

    await assert.rejects(
      economyService.credit(
        { ...creditInput, amount: 200 },
        { database },
      ),
      (error) =>
        error instanceof EconomyError && error.code === "IDEMPOTENCY_CONFLICT",
    );

    await assert.rejects(
      economyService.debit(
        {
          ...creditInput,
          amount: 101,
          idempotencyKey: `m5:${testRunId}:insufficient`,
        },
        { database },
      ),
      (error) =>
        error instanceof EconomyError && error.code === "INSUFFICIENT_GOLD",
    );

    const debit = await economyService.debit(
      {
        ...creditInput,
        amount: 40,
        idempotencyKey: `m5:${testRunId}:debit`,
      },
      { database },
    );

    assert.equal(debit.balanceAfter, "60");

    const shardCredit = await economyService.credit(
      {
        ...creditInput,
        currency: EconomyCurrency.SHARDS,
        amount: 12,
        idempotencyKey: `m5:${testRunId}:shards`,
      },
      { database },
    );
    assert.equal(shardCredit.balanceAfter, "12");

    const transferInput = {
      fromPlayerId: sourcePlayerId,
      toPlayerId: destinationPlayerId,
      currency: EconomyCurrency.GOLD,
      amount: 25,
      transactionType: "ADMIN_ADJUSTMENT",
      referenceType: "M5_TEST",
      referenceId: testRunId,
      idempotencyKey: `m5:${testRunId}:transfer`,
    };
    const transfer = await economyService.transfer(transferInput, { database });
    const replayedTransfer = await economyService.transfer(transferInput, {
      database,
    });

    assert.equal(transfer.debit.balanceAfter, "35");
    assert.equal(transfer.credit.balanceAfter, "25");
    assert.equal(transfer.replayed, false);
    assert.equal(replayedTransfer.replayed, true);

    const wallets = await database.query(
      `
        SELECT player_id, gold_balance, shard_balance
        FROM wallets
        WHERE player_id = ANY($1::BIGINT[])
        ORDER BY player_id
      `,
      [[sourcePlayerId, destinationPlayerId]],
    );
    const balances = new Map(
      wallets.rows.map((wallet) => [wallet.player_id, wallet.gold_balance]),
    );
    assert.equal(balances.get(sourcePlayerId), "35");
    assert.equal(balances.get(destinationPlayerId), "25");
    assert.equal(wallets.rows[0].shard_balance, "12");

    const ledgerCount = await database.query(
      `
        SELECT COUNT(*) AS transaction_count
        FROM economy_transactions
        WHERE player_id = ANY($1::BIGINT[])
      `,
      [[sourcePlayerId, destinationPlayerId]],
    );
    assert.equal(ledgerCount.rows[0].transaction_count, "5");

    const insufficientEntryCount = await database.query(
      `
        SELECT COUNT(*) AS transaction_count
        FROM economy_transactions
        WHERE idempotency_key = $1
      `,
      [`m5:${testRunId}:insufficient`],
    );
    assert.equal(insufficientEntryCount.rows[0].transaction_count, "0");

    await database.query("SAVEPOINT immutable_ledger_check");
    await assert.rejects(
      database.query(
        `
          UPDATE economy_transactions
          SET transaction_type = 'CHANGED'
          WHERE transaction_id = $1
        `,
        [credit.transaction.transactionId],
      ),
      (error) => error?.code === "55000",
    );
    await database.query("ROLLBACK TO SAVEPOINT immutable_ledger_check");
  } finally {
    await database.query("ROLLBACK");
    const residualLedgerEntries = await database.query(
      `
        SELECT COUNT(*) AS transaction_count
        FROM economy_transactions
        WHERE idempotency_key LIKE $1
      `,
      [`m5:${testRunId}:%`],
    );
    assert.equal(residualLedgerEntries.rows[0].transaction_count, "0");
    database.release();
    await pool.end();
  }
});
