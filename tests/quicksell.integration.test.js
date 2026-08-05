import assert from "node:assert/strict";
import test from "node:test";

import { gameConfig } from "../src/config/game-config.js";
import { getDatabaseConfig } from "../src/config/env.js";
import { createPostgresPool } from "../src/database/connection/postgres.js";
import {
  createCardInstanceService,
  createCardTemplateService,
} from "../src/modules/card/index.js";
import { createEconomyService } from "../src/modules/economy/index.js";
import { createPlayerService } from "../src/modules/player/index.js";
import {
  QuicksellError,
  createQuicksellService,
} from "../src/modules/quicksell/index.js";

test("quicksell atomically destroys a card and credits Shards", async () => {
  const pool = createPostgresPool({
    connectionString: getDatabaseConfig().databaseUrl,
  });
  const database = await pool.connect();
  const economyService = createEconomyService({ databasePool: pool });
  const playerService = createPlayerService({ databasePool: pool, economyService });
  const cardTemplateService = createCardTemplateService({ databasePool: pool });
  const cardInstanceService = createCardInstanceService({
    databasePool: pool,
    cardTemplateService,
    playerService,
  });
  const quicksellService = createQuicksellService({
    databasePool: pool,
    economyService,
    quicksellConfig: gameConfig.quicksell,
  });
  const testRunId = Date.now().toString();

  try {
    await database.query("BEGIN");
    const playerResult = await database.query(
      `INSERT INTO players (discord_user_id, username_snapshot)
       VALUES ($1, 'M13QuicksellPlayer') RETURNING player_id`,
      [`985${testRunId}`],
    );
    const playerId = playerResult.rows[0].player_id;
    await economyService.ensureWallet(playerId, { database });
    const template = await cardTemplateService.createTemplate(
      {
        playerName: "M13 Test Player",
        edition: `Quicksell ${testRunId}`,
        season: "2026-27",
        primaryPosition: "SG",
        secondaryPosition: null,
        rarityCode: "ALPHA",
        overall: 88,
        insideScoring: 80,
        midRange: 85,
        threePoint: 87,
        playmaking: 78,
        perimeterDefense: 82,
        interiorDefense: 55,
        rebounding: 60,
        athleticism: 84,
        heightCm: null,
        weightKg: null,
        packable: true,
        releaseDate: null,
      },
      { database },
    );
    const mint = await cardInstanceService.mintCard(
      {
        cardTemplateId: template.cardTemplateId,
        ownerPlayerId: playerId,
        cardLevel: 1,
        obtainedMethod: "ADMIN_GRANT",
      },
      { database },
    );

    const result = await quicksellService.quicksell(
      { playerId, cardInstanceId: mint.instance.cardInstanceId },
      { database },
    );

    assert.equal(result.shardReward, 30);
    assert.equal(result.shardBalance, "30");
    const state = await database.query(
      `
        SELECT
          ci.status,
          ci.owner_player_id,
          cmc.current_circulation,
          et.amount,
          et.transaction_type,
          coh.reason
        FROM card_instances ci
        JOIN card_mint_counters cmc
          ON cmc.card_template_id = ci.card_template_id
        JOIN economy_transactions et
          ON et.reference_type = 'CARD_INSTANCE'
          AND et.reference_id = ci.card_instance_id::TEXT
        JOIN card_ownership_history coh
          ON coh.card_instance_id = ci.card_instance_id
          AND coh.reason = 'QUICKSELL'
        WHERE ci.card_instance_id = $1
      `,
      [mint.instance.cardInstanceId],
    );
    assert.equal(state.rows[0].status, "DESTROYED_QUICKSELL");
    assert.equal(state.rows[0].owner_player_id, null);
    assert.equal(state.rows[0].current_circulation, "0");
    assert.equal(state.rows[0].amount, "30");
    assert.equal(state.rows[0].transaction_type, "QUICKSELL");
    assert.equal(state.rows[0].reason, "QUICKSELL");

    await assert.rejects(
      quicksellService.quicksell(
        { playerId, cardInstanceId: mint.instance.cardInstanceId },
        { database },
      ),
      (error) =>
        error instanceof QuicksellError && error.code === "CARD_NOT_OWNED",
    );
  } finally {
    await database.query("ROLLBACK");
    database.release();
    await pool.end();
  }
});
