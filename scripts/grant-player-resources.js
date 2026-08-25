import { getDatabaseConfig } from "../src/config/env.js";
import { createPostgresPool } from "../src/database/connection/postgres.js";
import { withTransaction } from "../src/database/transaction/transaction-manager.js";
import { EconomyCurrency, createEconomyService } from "../src/modules/economy/index.js";

function positiveInteger(value, name) {
  if (!/^\d+$/.test(value ?? "") || BigInt(value) <= 0n) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return value;
}

function parseArguments() {
  const [discordUserId, gold, shards, grantId] = process.argv.slice(2);
  if (!/^\d{17,20}$/.test(discordUserId ?? "")) {
    throw new Error("discord_user_id must be a valid Discord ID.");
  }
  if (!/^[a-z0-9][a-z0-9_-]{2,63}$/i.test(grantId ?? "")) {
    throw new Error("grant_id must contain 3-64 letters, numbers, underscores, or hyphens.");
  }
  return {
    discordUserId,
    gold: positiveInteger(gold, "gold"),
    shards: positiveInteger(shards, "shards"),
    grantId,
  };
}

async function grantPlayerResources() {
  const input = parseArguments();
  const pool = createPostgresPool({
    connectionString: getDatabaseConfig().databaseUrl,
  });
  const economyService = createEconomyService({ databasePool: pool });

  try {
    const result = await withTransaction(pool, async (database) => {
      const playerResult = await database.query(
        `SELECT player_id FROM players WHERE discord_user_id = $1`,
        [input.discordUserId],
      );
      const playerId = playerResult.rows[0]?.player_id;
      if (!playerId) throw new Error("Player was not found.");
      await economyService.ensureWallet(playerId, { database });
      const referenceId = input.grantId;
      const goldResult = await economyService.credit({
        playerId,
        currency: EconomyCurrency.GOLD,
        amount: input.gold,
        transactionType: "ADMIN_GRANT",
        referenceType: "ADMIN_PLAYER_GRANT",
        referenceId,
        idempotencyKey: `admin-player-grant:${referenceId}:gold:${playerId}`,
      }, { database });
      const shardResult = await economyService.credit({
        playerId,
        currency: EconomyCurrency.SHARDS,
        amount: input.shards,
        transactionType: "ADMIN_GRANT",
        referenceType: "ADMIN_PLAYER_GRANT",
        referenceId,
        idempotencyKey: `admin-player-grant:${referenceId}:shards:${playerId}`,
      }, { database });
      return {
        goldBalance: goldResult.balanceAfter,
        shardBalance: shardResult.balanceAfter,
        replayed: goldResult.replayed && shardResult.replayed,
      };
    });
    console.log(
      `Resource grant ${result.replayed ? "replayed" : "completed"}. ` +
      `New balances: ${result.goldBalance} Gold, ${result.shardBalance} Shards.`,
    );
  } finally {
    await pool.end();
  }
}

grantPlayerResources().catch((error) => {
  console.error(`Player resource grant failed: ${error.message}`);
  process.exitCode = 1;
});
