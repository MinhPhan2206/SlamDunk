import assert from "node:assert/strict";
import test from "node:test";

import { getTestDatabaseConfig } from "../src/config/env.js";
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
    connectionString: getTestDatabaseConfig().databaseUrl,
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
      amount: 500_000,
      transactionType: "TEST",
      idempotencyKey: `pack-batch:${runId}:funding`,
    }, { database });

    let templateRoll = 0;
    const batchPackService = createPackService({
      packCatalog: gameConfig.packs,
      databasePool: pool,
      economyService: economy,
      cardTemplateService,
      cardInstanceService,
      rollInteger: (minimum, maximum) => maximum < 100
        ? minimum + templateRoll++ % (maximum - minimum)
        : minimum,
    });
    const input = {
      playerId,
      packCode: "standard",
      quantity: 100,
      interactionId: `pack-batch-${runId}`,
    };
    const openingQueries = [];
    const recordingDatabase = {
      query(...arguments_) {
        openingQueries.push(String(arguments_[0]));
        return database.query(...arguments_);
      },
    };
    const opened = await batchPackService.openPack(input, {
      database: recordingDatabase,
    });
    assert.equal(opened.packQuantity, 100);
    assert.equal(opened.totalPrice, 500_000);
    assert.equal(opened.cards.length, 300);
    assert.equal(new Set(opened.instances.map((card) => card.publicCardId)).size, 300);
    assert.ok(new Set(opened.templates.map((card) => card.cardTemplateId)).size > 1);
    assert.equal(
      openingQueries.filter((sql) => sql.includes("INSERT INTO card_mint_counters"))
        .length,
      1,
    );
    assert.equal(
      openingQueries.filter((sql) =>
        sql.includes("WHERE card_template_id = ANY($1::BIGINT[])")
      ).length,
      1,
    );
    assert.equal(
      openingQueries.filter((sql) =>
        sql.includes("FROM players WHERE player_id = ANY($1::BIGINT[])")
      ).length,
      1,
    );
    assert.ok(
      openingQueries.length <= 20,
      `Pack 100 used ${openingQueries.length} SQL queries.`,
    );

    const replayQueries = [];
    const replay = await batchPackService.openPack(input, {
      database: {
        query(...arguments_) {
          replayQueries.push(String(arguments_[0]));
          return database.query(...arguments_);
        },
      },
    });
    assert.equal(replay.replayed, true);
    assert.equal(replay.cards.length, 300);
    assert.equal(replayQueries.length, 4);
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
