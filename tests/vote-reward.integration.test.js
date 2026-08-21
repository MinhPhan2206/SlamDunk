import assert from "node:assert/strict";
import test from "node:test";

import { getDatabaseConfig } from "../src/config/env.js";
import { createPostgresPool } from "../src/database/connection/postgres.js";
import { createEconomyService } from "../src/modules/economy/index.js";
import { createVoteService } from "../src/modules/vote/index.js";

test("Top.gg vote reward is atomic, weighted, and idempotent", async () => {
  const pool = createPostgresPool({ connectionString: getDatabaseConfig().databaseUrl });
  const database = await pool.connect();
  const economy = createEconomyService({ databasePool: pool });
  const run = Date.now().toString();
  const discordId = `7777${run}`;
  const createdAt = new Date("2026-08-20T00:00:00.000Z");
  try {
    await database.query("BEGIN");
    const playerResult = await database.query(
      `INSERT INTO players (discord_user_id, username_snapshot)
       VALUES ($1, 'VoteTester') RETURNING player_id`,
      [discordId],
    );
    const playerId = playerResult.rows[0].player_id;
    await economy.ensureWallet(playerId, { database });
    const vote = createVoteService({
      databasePool: pool,
      economyService: economy,
      topGgClient: {
        async getActiveVote() {
          return {
            createdAt,
            expiresAt: new Date("2026-08-21T00:00:00.000Z"),
            weight: 2,
          };
        },
      },
      voteConfig: { goldPerWeight: 1_000, shardsPerWeight: 25 },
      botId: "222222222222222222",
    });
    const input = { playerId, discordUserId: discordId };
    const first = await vote.claimVote(input, { database });
    const replay = await vote.claimVote(input, { database });
    assert.equal(first.rewardGold, "2000");
    assert.equal(first.rewardShards, "50");
    assert.equal(first.replayed, false);
    assert.equal(replay.replayed, true);
    const wallet = await economy.getWallet(playerId, { database });
    assert.equal(wallet.goldBalance, "2000");
    assert.equal(wallet.shardBalance, "50");
  } finally {
    await database.query("ROLLBACK");
    database.release();
    await pool.end();
  }
});
