import assert from "node:assert/strict";
import test from "node:test";

import { getTestDatabaseConfig } from "../src/config/env.js";
import { gameConfig } from "../src/config/game-config.js";
import { createPostgresPool } from "../src/database/connection/postgres.js";
import { createBattleService } from "../src/modules/battle/index.js";
import { createEconomyService } from "../src/modules/economy/index.js";
import { createMarketService } from "../src/modules/market/index.js";
import { createPlayerService } from "../src/modules/player/index.js";
import { createRewardService } from "../src/modules/reward/index.js";
import {
  SecurityAccessError,
  createSecurityService,
} from "../src/modules/security/index.js";
import { createTradeService } from "../src/modules/trade/index.js";

async function createPlayer(database, suffix) {
  const result = await database.query(
    `
      INSERT INTO players (discord_user_id, username_snapshot)
      VALUES ($1, $2)
      RETURNING player_id
    `,
    [`88${Date.now()}${suffix}`, `Security ${suffix}`],
  );
  return String(result.rows[0].player_id);
}

async function restrict(database, playerId, field, value) {
  await database.query(
    `
      INSERT INTO player_security_profiles (player_id, ${field})
      VALUES ($1, $2)
      ON CONFLICT (player_id) DO UPDATE SET ${field} = $2
    `,
    [playerId, value],
  );
}

test("security profiles enforce independent active, earning, and trading policies", async () => {
  const pool = createPostgresPool({ connectionString: getTestDatabaseConfig().databaseUrl });
  const database = await pool.connect();
  const security = createSecurityService({ databasePool: pool });
  try {
    await database.query("BEGIN");
    const playerId = await createPlayer(database, "01");
    const future = new Date(Date.now() + 3_600_000);

    await restrict(database, playerId, "earning_frozen_until", future);
    await assert.rejects(
      () => security.assertCanEarn({ playerId }, { database }),
      (error) => error instanceof SecurityAccessError && error.code === "EARNINGS_FROZEN",
    );
    await assert.doesNotReject(() =>
      security.assertCanTrade({ playerIds: [playerId] }, { database })
    );

    await restrict(database, playerId, "earning_frozen_until", null);
    await restrict(database, playerId, "trading_frozen_until", future);
    await assert.rejects(
      () => security.assertCanTrade({ playerIds: [playerId] }, { database }),
      (error) => error instanceof SecurityAccessError && error.code === "TRADING_FROZEN",
    );
    await assert.doesNotReject(() =>
      security.assertCanEarn({ playerId }, { database })
    );

    await restrict(database, playerId, "disabled_until", future);
    await assert.rejects(
      () => security.assertPlayerActive({ playerId }, { database }),
      (error) => error instanceof SecurityAccessError && error.code === "PLAYER_DISABLED",
    );

    await database.query(
      `
        UPDATE player_security_profiles
        SET earning_frozen_until = NULL, trading_frozen_until = NULL,
          disabled_until = CURRENT_TIMESTAMP - INTERVAL '1 minute',
          risk_score = 9999
        WHERE player_id = $1
      `,
      [playerId],
    );
    await assert.doesNotReject(() =>
      security.assertCanEarn({ playerId }, { database })
    );
    await assert.doesNotReject(() =>
      security.assertCanTrade({ playerIds: [playerId] }, { database })
    );
  } finally {
    await database.query("ROLLBACK");
    database.release();
    await pool.end();
  }
});

test("earning freeze blocks Claim before cooldown or ledger mutation", async () => {
  const pool = createPostgresPool({ connectionString: getTestDatabaseConfig().databaseUrl });
  const database = await pool.connect();
  const economy = createEconomyService({ databasePool: pool });
  const players = createPlayerService({ databasePool: pool, economyService: economy });
  const security = createSecurityService({ databasePool: pool });
  const rewards = createRewardService({
    databasePool: pool,
    economyService: economy,
    playerService: players,
    securityService: security,
    claimConfig: gameConfig.claim,
    dailyConfig: gameConfig.daily,
    weeklyConfig: gameConfig.weekly,
  });
  try {
    await database.query("BEGIN");
    const playerId = await createPlayer(database, "02");
    await economy.ensureWallet(playerId, { database });
    await restrict(
      database,
      playerId,
      "earning_frozen_until",
      new Date(Date.now() + 3_600_000),
    );

    await assert.rejects(
      () => rewards.claimReward(
        { playerId, interactionId: `99${Date.now()}02` },
        { database },
      ),
      (error) => error instanceof SecurityAccessError && error.code === "EARNINGS_FROZEN",
    );
    const ledger = await database.query(
      "SELECT COUNT(*)::INTEGER AS count FROM economy_transactions WHERE player_id = $1",
      [playerId],
    );
    const cooldown = await database.query(
      "SELECT COUNT(*)::INTEGER AS count FROM player_cooldowns WHERE player_id = $1",
      [playerId],
    );
    assert.equal(ledger.rows[0].count, 0);
    assert.equal(cooldown.rows[0].count, 0);
  } finally {
    await database.query("ROLLBACK");
    database.release();
    await pool.end();
  }
});

test("trading freeze is enforced by Market, Trade, and wagered Duel services", async () => {
  const pool = createPostgresPool({ connectionString: getTestDatabaseConfig().databaseUrl });
  const database = await pool.connect();
  const security = createSecurityService({ databasePool: pool });
  try {
    await database.query("BEGIN");
    const frozenPlayerId = await createPlayer(database, "03");
    const otherPlayerId = await createPlayer(database, "04");
    await restrict(
      database,
      frozenPlayerId,
      "trading_frozen_until",
      new Date(Date.now() + 3_600_000),
    );
    const cardInstanceService = {
      lockForMarket: async () => assert.fail("Market reached Card mutation"),
    };
    const market = createMarketService({
      databasePool: pool,
      cardInstanceService,
      economyService: {},
      securityService: security,
    });
    await assert.rejects(
      () => market.createListing(
        {
          sellerPlayerId: frozenPlayerId,
          cardInstanceId: "1",
          priceGold: 100,
          durationCode: "12h",
        },
        { database },
      ),
      (error) => error instanceof SecurityAccessError && error.code === "TRADING_FROZEN",
    );

    const trade = createTradeService({
      databasePool: pool,
      cardInstanceService: {},
      economyService: {},
      inventoryService: { consumeItem() {}, grantItem() {} },
      playerService: { getPlayerById: async () => ({}) },
      securityService: security,
      tradeConfig: gameConfig.trade,
    });
    await assert.rejects(
      () => trade.createTrade(
        { initiatorPlayerId: frozenPlayerId, invitedPlayerId: otherPlayerId },
        { database },
      ),
      (error) => error instanceof SecurityAccessError && error.code === "TRADING_FROZEN",
    );

    const battle = createBattleService({
      databasePool: pool,
      lineupService: {},
      cardInstanceService: {},
      cardTemplateService: {},
      traitService: {},
      playerService: {},
      economyService: { credit() {} },
      securityService: security,
      battleConfig: gameConfig.battle,
    });
    await assert.rejects(
      () => battle.createDuelChallenge(
        {
          challengerPlayerId: frozenPlayerId,
          challengedPlayerId: otherPlayerId,
          interactionId: `99${Date.now()}03`,
          betGold: 100,
        },
        { database },
      ),
      (error) => error instanceof SecurityAccessError && error.code === "TRADING_FROZEN",
    );

    const counts = [];
    counts.push(await database.query(
      "SELECT COUNT(*)::INTEGER AS count FROM market_listings WHERE seller_player_id = $1",
      [frozenPlayerId],
    ));
    counts.push(await database.query(
      "SELECT COUNT(*)::INTEGER AS count FROM trades WHERE created_by_player_id = $1",
      [frozenPlayerId],
    ));
    counts.push(await database.query(
      "SELECT COUNT(*)::INTEGER AS count FROM duel_challenges WHERE challenger_player_id = $1",
      [frozenPlayerId],
    ));
    counts.forEach((result) => assert.equal(result.rows[0].count, 0));
  } finally {
    await database.query("ROLLBACK");
    database.release();
    await pool.end();
  }
});
