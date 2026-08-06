import assert from "node:assert/strict";
import test from "node:test";

import { gameConfig } from "../src/config/game-config.js";
import { getDatabaseConfig } from "../src/config/env.js";
import { createPostgresPool } from "../src/database/connection/postgres.js";
import {
  createCardInstanceService,
  createCardTemplateService,
} from "../src/modules/card/index.js";
import { createPlayerService } from "../src/modules/player/index.js";
import {
  UpgradeError,
  createUpgradeService,
} from "../src/modules/upgrade/index.js";

function templateInput(testRunId) {
  return {
    playerName: `M14 Test Player ${testRunId}`,
    primaryPosition: "PF",
    secondaryPosition: null,
    rarityCode: "UNCOMMON",
    overall: 86,
    finishing: 84,
    midRange: 81,
    threePoint: 74,
    playmaking: 72,
    perimeterDefense: 76,
    interiorDefense: 85,
    strength: 86,
    heightCm: null,
    packable: true,
  };
}

test("Fusion and Level Up item usage preserve Card lifecycle invariants", async () => {
  const pool = createPostgresPool({
    connectionString: getDatabaseConfig().databaseUrl,
  });
  const database = await pool.connect();
  const cardTemplateService = createCardTemplateService({ databasePool: pool });
  const playerService = createPlayerService({ databasePool: pool });
  const cardInstanceService = createCardInstanceService({
    databasePool: pool,
    cardTemplateService,
    playerService,
  });
  const upgradeService = createUpgradeService({
    databasePool: pool,
    cardInstanceService,
    upgradeConfig: gameConfig.upgrade,
  });
  const testRunId = Date.now().toString();

  try {
    await database.query("BEGIN");
    const playerResult = await database.query(
      `INSERT INTO players (discord_user_id, username_snapshot)
       VALUES ($1, 'M14UpgradePlayer') RETURNING player_id`,
      [`984${testRunId}`],
    );
    const playerId = playerResult.rows[0].player_id;
    const template = await cardTemplateService.createTemplate(
      templateInput(testRunId),
      { database },
    );
    const sourceA = await cardInstanceService.mintCard(
      {
        cardTemplateId: template.cardTemplateId,
        ownerPlayerId: playerId,
        cardLevel: 4,
        obtainedMethod: "ADMIN_GRANT",
      },
      { database },
    );
    const sourceB = await cardInstanceService.mintCard(
      {
        cardTemplateId: template.cardTemplateId,
        ownerPlayerId: playerId,
        cardLevel: 2,
        obtainedMethod: "ADMIN_GRANT",
      },
      { database },
    );

    const fusion = await upgradeService.fuseCards(
      {
        playerId,
        sourceCardAId: sourceA.instance.cardInstanceId,
        sourceCardBId: sourceB.instance.cardInstanceId,
      },
      { database },
    );

    assert.equal(fusion.resultCard.cardLevel, 5);
    assert.equal(fusion.resultCard.serialNumber, "3");
    assert.equal(fusion.resultCard.obtainedMethod, "FUSION");
    const fusionState = await database.query(
      `
        SELECT
          (SELECT COUNT(*) FROM card_instances
           WHERE card_instance_id = ANY($1::BIGINT[])
             AND status = 'DESTROYED_FUSION'
             AND owner_player_id IS NULL) AS destroyed_sources,
          (SELECT current_circulation FROM card_mint_counters
           WHERE card_template_id = $2) AS current_circulation,
          (SELECT total_minted FROM card_mint_counters
           WHERE card_template_id = $2) AS total_minted,
          (SELECT COUNT(*) FROM fusion_sources
           WHERE fusion_id = $3) AS fusion_sources
      `,
      [
        [sourceA.instance.cardInstanceId, sourceB.instance.cardInstanceId],
        template.cardTemplateId,
        fusion.fusion.fusionId,
      ],
    );
    assert.equal(fusionState.rows[0].destroyed_sources, "2");
    assert.equal(fusionState.rows[0].current_circulation, "1");
    assert.equal(fusionState.rows[0].total_minted, "3");
    assert.equal(fusionState.rows[0].fusion_sources, "2");

    const upgradeCard = await cardInstanceService.mintCard(
      {
        cardTemplateId: template.cardTemplateId,
        ownerPlayerId: playerId,
        cardLevel: 2,
        obtainedMethod: "ADMIN_GRANT",
      },
      { database },
    );
    await database.query(
      `INSERT INTO player_items (player_id, item_type, quantity)
       VALUES ($1, 'LEVEL_UP', 1)`,
      [playerId],
    );
    const upgrade = await upgradeService.useLevelUpItem(
      { playerId, cardInstanceId: upgradeCard.instance.cardInstanceId },
      { database },
    );

    assert.equal(upgrade.previousLevel, 2);
    assert.equal(upgrade.newLevel, 3);
    assert.equal(upgrade.remainingItems, 0);
    const usageState = await database.query(
      `
        SELECT ci.card_level, pi.quantity, u.previous_level, u.new_level
        FROM card_instances ci
        JOIN player_items pi ON pi.player_id = ci.owner_player_id
          AND pi.item_type = 'LEVEL_UP'
        JOIN upgrade_item_usages u ON u.card_instance_id = ci.card_instance_id
        WHERE ci.card_instance_id = $1
      `,
      [upgradeCard.instance.cardInstanceId],
    );
    assert.equal(usageState.rows[0].card_level, 3);
    assert.equal(usageState.rows[0].quantity, 0);
    assert.equal(usageState.rows[0].previous_level, 2);
    assert.equal(usageState.rows[0].new_level, 3);

    await database.query(
      `UPDATE player_items SET quantity = 1
       WHERE player_id = $1 AND item_type = 'LEVEL_UP'`,
      [playerId],
    );
    await assert.rejects(
      upgradeService.useLevelUpItem(
        { playerId, cardInstanceId: fusion.resultCard.cardInstanceId },
        { database },
      ),
      (error) =>
        error instanceof UpgradeError && error.code === "CARD_MAX_LEVEL",
    );
    const remainingItem = await database.query(
      `SELECT quantity FROM player_items
       WHERE player_id = $1 AND item_type = 'LEVEL_UP'`,
      [playerId],
    );
    assert.equal(remainingItem.rows[0].quantity, 1);
  } finally {
    await database.query("ROLLBACK");
    database.release();
    await pool.end();
  }
});
