import assert from "node:assert/strict";
import test from "node:test";

import { getTestDatabaseConfig } from "../src/config/env.js";
import { gameConfig } from "../src/config/game-config.js";
import { createPostgresPool } from "../src/database/connection/postgres.js";
import {
  CardError,
  createCardInstanceService,
  createCardTemplateService,
} from "../src/modules/card/index.js";
import { createPlayerService } from "../src/modules/player/index.js";
import { createUpgradeService } from "../src/modules/upgrade/index.js";

test("account-bound Cards cannot transfer and remain bound through Fusion", async () => {
  const pool = createPostgresPool({
    connectionString: getTestDatabaseConfig().databaseUrl,
  });
  const database = await pool.connect();
  const templates = createCardTemplateService({ databasePool: pool });
  const players = createPlayerService({ databasePool: pool });
  const cards = createCardInstanceService({
    databasePool: pool,
    cardTemplateService: templates,
    playerService: players,
  });
  const upgrade = createUpgradeService({
    databasePool: pool,
    cardInstanceService: cards,
    upgradeConfig: gameConfig.upgrade,
  });
  const runId = Date.now().toString();
  try {
    await database.query("BEGIN");
    const player = await database.query(
      "INSERT INTO players (discord_user_id, username_snapshot) VALUES ($1, 'BoundTest') RETURNING player_id",
      [`939${runId}`],
    );
    const playerId = player.rows[0].player_id;
    const template = (await templates.listPackableTemplates({ database }))[0];
    const mints = [];
    for (let index = 0; index < 2; index += 1) {
      mints.push(await cards.mintCard({
        cardTemplateId: template.cardTemplateId,
        ownerPlayerId: playerId,
        cardLevel: 1,
        obtainedMethod: "EVENT_REWARD",
        accountBound: true,
      }, { database }));
    }
    await assert.rejects(
      cards.lockForMarket({
        cardInstanceId: mints[0].instance.cardInstanceId,
        ownerPlayerId: playerId,
      }, { database }),
      (error) => error instanceof CardError && error.code === "CARD_ACCOUNT_BOUND",
    );
    await assert.rejects(
      cards.lockForTrade({
        cardInstanceId: mints[0].instance.cardInstanceId,
        ownerPlayerId: playerId,
      }, { database }),
      (error) => error instanceof CardError && error.code === "CARD_ACCOUNT_BOUND",
    );
    const fusion = await upgrade.fuseCards({
      playerId,
      sourceCardIds: mints.map((mint) => mint.instance.cardInstanceId),
    }, { database });
    assert.equal(fusion.resultCard.accountBound, true);
  } finally {
    await database.query("ROLLBACK");
    database.release();
    await pool.end();
  }
});
