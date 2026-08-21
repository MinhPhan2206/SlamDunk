import assert from "node:assert/strict";
import test from "node:test";

import { getDatabaseConfig } from "../src/config/env.js";
import { gameConfig } from "../src/config/game-config.js";
import { createPostgresPool } from "../src/database/connection/postgres.js";
import { createCardInstanceService, createCardTemplateService } from "../src/modules/card/index.js";
import { createContractService } from "../src/modules/contract/index.js";
import { createEconomyService } from "../src/modules/economy/index.js";
import { createInventoryService } from "../src/modules/inventory/index.js";
import { createLevelRewardService } from "../src/modules/level-reward/index.js";
import { createPlayerService } from "../src/modules/player/index.js";

test("Player Level rewards through Level 30 are atomic and idempotent", async () => {
  const pool = createPostgresPool({ connectionString: getDatabaseConfig().databaseUrl });
  const database = await pool.connect();
  const economy = createEconomyService({ databasePool: pool });
  const players = createPlayerService({ databasePool: pool, economyService: economy });
  const inventory = createInventoryService({ databasePool: pool });
  const templates = createCardTemplateService({ databasePool: pool });
  const cards = createCardInstanceService({
    databasePool: pool,
    cardTemplateService: templates,
    playerService: players,
  });
  const rewards = createLevelRewardService({
    databasePool: pool,
    economyService: economy,
    inventoryService: inventory,
    cardTemplateService: templates,
    cardInstanceService: cards,
    levelRewardConfig: gameConfig.levelRewards,
    rollInteger: (minimum) => minimum,
  });
  const contracts = createContractService({
    databasePool: pool,
    inventoryService: inventory,
    cardTemplateService: templates,
    cardInstanceService: cards,
    contractCatalog: gameConfig.contracts,
    rollInteger: (minimum, maximum) => maximum === 100 ? maximum - 1 : minimum,
  });
  const run = Date.now().toString();
  try {
    await database.query("BEGIN");
    const created = await database.query(
      `INSERT INTO players (discord_user_id, username_snapshot, player_level, xp)
       VALUES ($1, 'LevelRewardTester', 30, 465000)
       RETURNING player_id`,
      [`884${run}`],
    );
    const playerId = created.rows[0].player_id;
    await economy.ensureWallet(playerId, { database });

    const first = await rewards.claimAvailable({ playerId }, { database });
    const replay = await rewards.claimAvailable({ playerId }, { database });
    assert.equal(first.newClaims.length, 8);
    assert.equal(replay.newClaims.length, 0);
    assert.ok(first.milestones.every(({ claimed }) => claimed));

    const wallet = await economy.getWallet(playerId, { database });
    assert.equal(wallet.goldBalance, "5000");
    assert.equal(wallet.shardBalance, "6300");
    const items = await database.query(
      `SELECT item_type, quantity FROM player_items WHERE player_id = $1 ORDER BY item_type`,
      [playerId],
    );
    assert.deepEqual(items.rows, [
      { item_type: "ALL_STAR_CONTRACT", quantity: 3 },
      { item_type: "ALPHA_CONTRACT", quantity: 1 },
      { item_type: "LEVEL_UP", quantity: 3 },
    ]);
    const instances = await database.query(
      `
        SELECT r.rarity_code, ci.card_level, COUNT(*)::integer AS count
        FROM card_instances ci
        JOIN card_templates ct ON ct.card_template_id = ci.card_template_id
        JOIN rarities r ON r.rarity_id = ct.rarity_id
        WHERE ci.owner_player_id = $1 AND ci.obtained_method = 'EVENT_REWARD'
        GROUP BY r.rarity_code, ci.card_level
        ORDER BY r.rarity_code
      `,
      [playerId],
    );
    assert.deepEqual(instances.rows, []);
    const claims = await database.query(
      `SELECT COUNT(*)::integer AS count FROM player_level_reward_claims WHERE player_id = $1`,
      [playerId],
    );
    assert.equal(claims.rows[0].count, 8);

    const opened = await contracts.openContract({
      playerId,
      contractCode: "alpha",
      interactionId: `contract-${run}`,
    }, { database });
    const openingReplay = await contracts.openContract({
      playerId,
      contractCode: "alpha",
      interactionId: `contract-${run}`,
    }, { database });
    assert.equal(opened.template.rarityCode, "ALPHA");
    assert.equal(opened.instance.cardLevel, 5);
    assert.equal(opened.remainingQuantity, 0);
    assert.equal(openingReplay.replayed, true);
    assert.equal(openingReplay.instance.cardInstanceId, opened.instance.cardInstanceId);
    const allStarOpened = await contracts.openContract({
      playerId,
      contractCode: "all_star",
      interactionId: `all-star-contract-${run}`,
    }, { database });
    assert.equal(allStarOpened.template.rarityCode, "ALL_STAR");
    assert.equal(allStarOpened.instance.cardLevel, 5);
    assert.equal(allStarOpened.remainingQuantity, 2);
    const contractItem = await database.query(
      `SELECT quantity FROM player_items WHERE player_id = $1 AND item_type = 'ALPHA_CONTRACT'`,
      [playerId],
    );
    assert.equal(contractItem.rows[0].quantity, 0);
  } finally {
    await database.query("ROLLBACK");
    database.release();
    await pool.end();
  }
});
