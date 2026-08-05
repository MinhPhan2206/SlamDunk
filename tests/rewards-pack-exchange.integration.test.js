import assert from "node:assert/strict";
import test from "node:test";

import { getDatabaseConfig } from "../src/config/env.js";
import { gameConfig } from "../src/config/game-config.js";
import { createPostgresPool } from "../src/database/connection/postgres.js";
import { createCardInstanceService, createCardTemplateService } from "../src/modules/card/index.js";
import { createEconomyService } from "../src/modules/economy/index.js";
import { createExchangeService } from "../src/modules/exchange/index.js";
import { createPackService } from "../src/modules/pack/index.js";
import { createPlayerService } from "../src/modules/player/index.js";
import { createRewardService } from "../src/modules/reward/index.js";

test("Daily, Standard Pack, and Shard exchange update resources atomically", async () => {
  const pool = createPostgresPool({ connectionString: getDatabaseConfig().databaseUrl });
  const database = await pool.connect();
  const economy = createEconomyService({ databasePool: pool });
  const playerService = createPlayerService({ databasePool: pool, economyService: economy });
  const templates = createCardTemplateService({ databasePool: pool });
  const instances = createCardInstanceService({ databasePool: pool, cardTemplateService: templates, playerService });
  const reward = createRewardService({
    databasePool: pool, economyService: economy,
    claimConfig: gameConfig.claim, dailyConfig: gameConfig.daily,
    rollInteger: (minimum) => minimum,
  });
  const pack = createPackService({
    packCatalog: gameConfig.packs, databasePool: pool, economyService: economy,
    cardTemplateService: templates, cardInstanceService: instances,
    rollInteger: (minimum) => minimum,
  });
  const exchange = createExchangeService({
    databasePool: pool, economyService: economy,
    exchangeConfig: gameConfig.exchange, upgradeConfig: gameConfig.upgrade,
  });
  const run = Date.now().toString();
  try {
    await database.query("BEGIN");
    const row = await database.query(
      "INSERT INTO players (discord_user_id, username_snapshot) VALUES ($1, 'ResourceTest') RETURNING player_id",
      [`930${run}`],
    );
    const playerId = row.rows[0].player_id;
    await economy.ensureWallet(playerId, { database });
    await economy.credit({ playerId, currency: "GOLD", amount: 5000, transactionType: "TEST", idempotencyKey: `resource:${run}:gold` }, { database });
    await economy.credit({ playerId, currency: "SHARDS", amount: 1000, transactionType: "TEST", idempotencyKey: `resource:${run}:shards` }, { database });

    const daily = await reward.dailyReward({ playerId, interactionId: `931${run}` }, { database });
    assert.equal(daily.rewardGold, "1500");
    assert.equal(daily.rewardShards, "20");

    const opened = await pack.openPack({ playerId, packCode: "standard", interactionId: `932${run}` }, { database });
    assert.equal(opened.pack.priceGold, 1000);
    assert.equal(opened.opening.status, "COMPLETED");

    const exchanged = await exchange.exchange({ playerId, offerCode: "level_up", interactionId: `933${run}` }, { database });
    assert.equal(exchanged.offer.inputAmount, 500);
    assert.equal(exchanged.itemQuantity, 1);
  } finally {
    await database.query("ROLLBACK");
    database.release();
    await pool.end();
  }
});
