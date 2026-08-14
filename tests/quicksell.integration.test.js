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

test("quicksell atomically destroys a card and credits Gold and Shards", async () => {
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
        playerName: `M13 Test Player ${testRunId}`,
        primaryPosition: "SG",
        secondaryPosition: null,
        rarityCode: "ALPHA",
        overall: 88,
        finishing: 80,
        midRange: 85,
        threePoint: 87,
        playmaking: 78,
        perimeterDefense: 82,
        interiorDefense: 55,
        strength: 75,
        heightCm: null,
        packable: true,
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

    assert.equal(result.goldReward, 250);
    assert.equal(result.shardReward, 30);
    assert.equal(result.goldBalance, "250");
    assert.equal(result.shardBalance, "30");
    const state = await database.query(
      `
        SELECT
          ci.status,
          ci.owner_player_id,
          cmc.current_circulation,
          et.currency,
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
        ORDER BY et.currency
      `,
      [mint.instance.cardInstanceId],
    );
    assert.equal(state.rows.length, 2);
    assert.equal(state.rows[0].status, "DESTROYED_QUICKSELL");
    assert.equal(state.rows[0].owner_player_id, null);
    assert.equal(state.rows[0].current_circulation, "0");
    assert.deepEqual(
      Object.fromEntries(state.rows.map((row) => [row.currency, row.amount])),
      { GOLD: "250", SHARDS: "30" },
    );
    assert.ok(state.rows.every((row) => row.transaction_type === "QUICKSELL"));
    assert.ok(state.rows.every((row) => row.reason === "QUICKSELL"));

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

test("lock protects cards and batch Quicksell requires a persisted confirmation", async () => {
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
       VALUES ($1, 'BatchQuicksellPlayer') RETURNING player_id`,
      [`986${testRunId}`],
    );
    const playerId = playerResult.rows[0].player_id;
    await economyService.ensureWallet(playerId, { database });
    const template = await cardTemplateService.createTemplate(
      {
        playerName: `Batch Test Player ${testRunId}`,
        primaryPosition: "PG", secondaryPosition: "SG",
        rarityCode: "COMMON", overall: 80, finishing: 75,
        midRange: 78, threePoint: 80, playmaking: 84,
        perimeterDefense: 70, interiorDefense: 40, strength: 70,
        heightCm: null, packable: true,
      },
      { database },
    );
    const first = await cardInstanceService.mintCard({
      cardTemplateId: template.cardTemplateId, ownerPlayerId: playerId,
      cardLevel: 1, obtainedMethod: "ADMIN_GRANT",
    }, { database });
    const protectedCard = await cardInstanceService.mintCard({
      cardTemplateId: template.cardTemplateId, ownerPlayerId: playerId,
      cardLevel: 2, obtainedMethod: "ADMIN_GRANT",
    }, { database });
    await cardInstanceService.lockOwnedCard({
      ownerPlayerId: playerId,
      cardInstanceId: protectedCard.instance.cardInstanceId,
    }, { database });

    const preview = await quicksellService.createPreview({
      playerId, params: "all", interactionId: `${testRunId}01`,
    }, { database });
    assert.equal(preview.cards.length, 1);
    assert.equal(preview.cards[0].cardInstanceId, first.instance.cardInstanceId);
    assert.equal(preview.session.totalGold, "20");
    assert.equal(preview.session.totalShards, "2");

    const completed = await quicksellService.confirmPreview({
      playerId,
      quicksellSessionId: preview.session.quicksellSessionId,
    }, { database });
    assert.equal(completed.session.status, "COMPLETED");
    assert.equal(completed.session.goldBalanceAfter, "20");
    assert.equal(completed.session.shardBalanceAfter, "2");

    const replayed = await quicksellService.confirmPreview({
      playerId,
      quicksellSessionId: preview.session.quicksellSessionId,
    }, { database });
    assert.equal(replayed.session.goldBalanceAfter, "20");
    assert.equal(replayed.session.shardBalanceAfter, "2");

    const states = await database.query(
      `SELECT card_instance_id, status, user_lock FROM card_instances
       WHERE card_instance_id = ANY($1::BIGINT[]) ORDER BY card_instance_id`,
      [[first.instance.cardInstanceId, protectedCard.instance.cardInstanceId]],
    );
    assert.equal(states.rows[0].status, "DESTROYED_QUICKSELL");
    assert.equal(states.rows[1].status, "ACTIVE");
    assert.equal(states.rows[1].user_lock, true);

    const unlocked = await cardInstanceService.unlockOwnedCard({
      ownerPlayerId: playerId,
      cardInstanceId: protectedCard.instance.cardInstanceId,
    }, { database });
    assert.equal(unlocked.userLock, false);
  } finally {
    await database.query("ROLLBACK");
    database.release();
    await pool.end();
  }
});
