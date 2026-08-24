import assert from "node:assert/strict";
import test from "node:test";

import { getDatabaseConfig } from "../src/config/env.js";
import { gameConfig } from "../src/config/game-config.js";
import { createPostgresPool } from "../src/database/connection/postgres.js";
import {
  createCardInstanceService,
  createCardTemplateService,
} from "../src/modules/card/index.js";
import { createEconomyService } from "../src/modules/economy/index.js";
import { createPackService } from "../src/modules/pack/index.js";
import { createPlayerService } from "../src/modules/player/index.js";

test("Pack batch charges once and bulk-mints every Card idempotently", async () => {
  const pool = createPostgresPool({
    connectionString: getDatabaseConfig().databaseUrl,
  });
  const database = await pool.connect();
  const economy = createEconomyService({ databasePool: pool });
  const playerService = createPlayerService({
    databasePool: pool,
    economyService: economy,
  });
  const cardTemplateService = createCardTemplateService({ databasePool: pool });
  const cardInstanceService = createCardInstanceService({
    databasePool: pool,
    cardTemplateService,
    playerService,
  });
  const packService = createPackService({
    packCatalog: gameConfig.packs,
    databasePool: pool,
    economyService: economy,
    cardTemplateService,
    cardInstanceService,
    rollInteger: (minimum) => minimum,
  });
  const runId = Date.now().toString();

  try {
    await database.query("BEGIN");
    const player = await database.query(
      "INSERT INTO players (discord_user_id, username_snapshot) VALUES ($1, 'PackBatch') RETURNING player_id",
      [`938${runId}`],
    );
    const playerId = player.rows[0].player_id;
    await economy.ensureWallet(playerId, { database });
    await economy.credit({
      playerId,
      currency: "GOLD",
      amount: 25_000,
      transactionType: "TEST",
      idempotencyKey: `pack-batch:${runId}:funding`,
    }, { database });

    const input = {
      playerId,
      packCode: "standard",
      quantity: 5,
      interactionId: `pack-batch-${runId}`,
    };
    const opened = await packService.openPack(input, { database });
    assert.equal(opened.packQuantity, 5);
    assert.equal(opened.totalPrice, 25_000);
    assert.equal(opened.cards.length, 15);
    assert.equal(new Set(opened.instances.map((card) => card.publicCardId)).size, 15);

    const replay = await packService.openPack(input, { database });
    assert.equal(replay.replayed, true);
    assert.equal(replay.cards.length, 15);
    const ledger = await database.query(
      "SELECT COUNT(*)::INTEGER AS count FROM economy_transactions WHERE idempotency_key = $1",
      [`pack:${input.interactionId}:gold`],
    );
    assert.equal(ledger.rows[0].count, 1);
  } finally {
    await database.query("ROLLBACK");
    database.release();
    await pool.end();
  }
});

