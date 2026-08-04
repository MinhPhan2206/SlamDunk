import assert from "node:assert/strict";
import test from "node:test";

import { gameConfig } from "../src/config/game-config.js";
import { getDatabaseConfig } from "../src/config/env.js";
import { createPostgresPool } from "../src/database/connection/postgres.js";
import { createEconomyService } from "../src/modules/economy/index.js";
import { RewardError, createRewardService } from "../src/modules/reward/index.js";

test("claim atomically credits Gold, records cooldown, and supports replay", async () => {
  const pool = createPostgresPool({
    connectionString: getDatabaseConfig().databaseUrl,
  });
  const database = await pool.connect();
  const economyService = createEconomyService({ databasePool: pool });
  let rollCount = 0;
  const rewardService = createRewardService({
    databasePool: pool,
    economyService,
    claimConfig: gameConfig.claim,
    rollInteger(minimum, maximumExclusive) {
      assert.equal(minimum, 300);
      assert.equal(maximumExclusive, 501);
      rollCount += 1;
      return 400;
    },
  });
  const testRunId = Date.now().toString();
  const firstInteractionId = `995${testRunId}`;
  const secondInteractionId = `996${testRunId}`;

  try {
    await database.query("BEGIN");

    const playerResult = await database.query(
      `
        INSERT INTO players (discord_user_id, username_snapshot)
        VALUES ($1, 'M6ClaimPlayer')
        RETURNING player_id
      `,
      [`994${testRunId}`],
    );
    const playerId = playerResult.rows[0].player_id;
    await database.query("INSERT INTO wallets (player_id) VALUES ($1)", [
      playerId,
    ]);

    const transactionTimeResult = await database.query(
      "SELECT CURRENT_TIMESTAMP AS current_time",
    );
    const transactionTime = transactionTimeResult.rows[0].current_time;
    const firstClaim = await rewardService.claimReward(
      { playerId, interactionId: firstInteractionId },
      { database },
    );

    assert.equal(firstClaim.rewardGold, "400");
    assert.equal(firstClaim.balanceAfter, "400");
    assert.equal(firstClaim.replayed, false);
    assert.equal(
      firstClaim.availableAt.getTime() - transactionTime.getTime(),
      30 * 60_000,
    );

    const replayedClaim = await rewardService.claimReward(
      { playerId, interactionId: firstInteractionId },
      { database },
    );
    assert.equal(replayedClaim.rewardGold, "400");
    assert.equal(replayedClaim.balanceAfter, "400");
    assert.equal(replayedClaim.replayed, true);
    assert.equal(rollCount, 1);

    await assert.rejects(
      rewardService.claimReward(
        { playerId, interactionId: secondInteractionId },
        { database },
      ),
      (error) =>
        error instanceof RewardError &&
        error.code === "CLAIM_COOLDOWN_ACTIVE" &&
        error.details.availableAt.getTime() === firstClaim.availableAt.getTime(),
    );

    await database.query(
      `
        UPDATE player_cooldowns
        SET available_at = CURRENT_TIMESTAMP
        WHERE player_id = $1 AND cooldown_type = 'CLAIM'
      `,
      [playerId],
    );

    const secondClaim = await rewardService.claimReward(
      { playerId, interactionId: secondInteractionId },
      { database },
    );
    assert.equal(secondClaim.rewardGold, "400");
    assert.equal(secondClaim.balanceAfter, "800");
    assert.equal(rollCount, 2);

    const walletResult = await database.query(
      "SELECT gold_balance FROM wallets WHERE player_id = $1",
      [playerId],
    );
    assert.equal(walletResult.rows[0].gold_balance, "800");

    const ledgerResult = await database.query(
      `
        SELECT amount, transaction_type, reference_type
        FROM economy_transactions
        WHERE player_id = $1
        ORDER BY transaction_id
      `,
      [playerId],
    );
    assert.deepEqual(ledgerResult.rows, [
      {
        amount: "400",
        transaction_type: "CLAIM",
        reference_type: "DISCORD_INTERACTION",
      },
      {
        amount: "400",
        transaction_type: "CLAIM",
        reference_type: "DISCORD_INTERACTION",
      },
    ]);
  } finally {
    await database.query("ROLLBACK");
    const residualLedgerEntries = await database.query(
      `
        SELECT COUNT(*) AS transaction_count
        FROM economy_transactions
        WHERE idempotency_key LIKE $1
      `,
      [`claim:%${testRunId}`],
    );
    assert.equal(residualLedgerEntries.rows[0].transaction_count, "0");
    database.release();
    await pool.end();
  }
});
