import assert from "node:assert/strict";
import test from "node:test";

import { getDatabaseConfig } from "../src/config/env.js";
import { createPostgresPool } from "../src/database/connection/postgres.js";
import {
  createCardInstanceService,
  createCardTemplateService,
} from "../src/modules/card/index.js";
import { EconomyCurrency, createEconomyService } from "../src/modules/economy/index.js";
import { createPlayerService } from "../src/modules/player/index.js";
import { TradeError, createTradeService } from "../src/modules/trade/index.js";

function templateInput(testRunId) {
  return {
    playerName: "M16 Test Player",
    edition: `Trade ${testRunId}`,
    season: "2026-27",
    primaryPosition: "SF",
    secondaryPosition: null,
    rarityTier: 3,
    overall: 85,
    insideScoring: 82,
    midRange: 84,
    threePoint: 81,
    playmaking: 76,
    perimeterDefense: 83,
    interiorDefense: 68,
    rebounding: 72,
    athleticism: 86,
    heightCm: null,
    weightKg: null,
    packable: true,
    releaseDate: null,
  };
}

test("Direct Trade clears confirmations and atomically exchanges cards and Gold", async () => {
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
  const tradeService = createTradeService({
    databasePool: pool,
    cardInstanceService,
    economyService,
    playerService,
  });
  const testRunId = Date.now().toString();

  try {
    await database.query("BEGIN");
    const playersResult = await database.query(
      `
        INSERT INTO players (discord_user_id, username_snapshot)
        VALUES ($1, 'M16PlayerA'), ($2, 'M16PlayerB')
        RETURNING player_id, username_snapshot
      `,
      [`978${testRunId}`, `979${testRunId}`],
    );
    const players = new Map(
      playersResult.rows.map((row) => [row.username_snapshot, row.player_id]),
    );
    const playerAId = players.get("M16PlayerA");
    const playerBId = players.get("M16PlayerB");
    for (const playerId of [playerAId, playerBId]) {
      await economyService.ensureWallet(playerId, { database });
    }
    for (const [playerId, amount, suffix] of [
      [playerAId, 500, "a"],
      [playerBId, 300, "b"],
    ]) {
      await economyService.credit(
        {
          playerId,
          currency: EconomyCurrency.GOLD,
          amount,
          transactionType: "ADMIN_ADJUSTMENT",
          referenceType: "M16_TEST",
          referenceId: testRunId,
          idempotencyKey: `m16:${testRunId}:${suffix}`,
        },
        { database },
      );
    }

    const template = await cardTemplateService.createTemplate(
      templateInput(testRunId),
      { database },
    );
    const cardA = await cardInstanceService.mintCard(
      {
        cardTemplateId: template.cardTemplateId,
        ownerPlayerId: playerAId,
        cardLevel: 2,
        obtainedMethod: "ADMIN_GRANT",
      },
      { database },
    );
    const cardB = await cardInstanceService.mintCard(
      {
        cardTemplateId: template.cardTemplateId,
        ownerPlayerId: playerBId,
        cardLevel: 4,
        obtainedMethod: "ADMIN_GRANT",
      },
      { database },
    );
    const lineupResult = await database.query(
      `INSERT INTO lineups (player_id) VALUES ($1) RETURNING lineup_id`,
      [playerAId],
    );
    await database.query(
      `INSERT INTO lineup_slots (lineup_id, slot, card_instance_id)
       VALUES ($1, 'SF', $2)`,
      [lineupResult.rows[0].lineup_id, cardA.instance.cardInstanceId],
    );

    let state = await tradeService.createTrade(
      { initiatorPlayerId: playerAId, invitedPlayerId: playerBId },
      { database },
    );
    const tradeId = state.trade.tradeId;
    await tradeService.addCard(
      { tradeId, playerId: playerAId, cardInstanceId: cardA.instance.cardInstanceId },
      { database },
    );
    await tradeService.addCard(
      { tradeId, playerId: playerBId, cardInstanceId: cardB.instance.cardInstanceId },
      { database },
    );
    await tradeService.setGoldOffer(
      { tradeId, playerId: playerAId, goldOffered: 100 },
      { database },
    );
    state = await tradeService.confirmTrade(
      { tradeId, playerId: playerAId },
      { database },
    );
    assert.equal(state.completed, false);
    state = await tradeService.setGoldOffer(
      { tradeId, playerId: playerBId, goldOffered: 40 },
      { database },
    );
    assert.ok(state.participants.every((participant) => !participant.confirmedAt));

    await tradeService.confirmTrade(
      { tradeId, playerId: playerAId },
      { database },
    );
    state = await tradeService.confirmTrade(
      { tradeId, playerId: playerBId },
      { database },
    );
    assert.equal(state.completed, true);
    assert.equal(state.trade.status, "COMPLETED");

    const finalState = await database.query(
      `
        SELECT
          (SELECT gold_balance FROM wallets WHERE player_id = $1) AS gold_a,
          (SELECT gold_balance FROM wallets WHERE player_id = $2) AS gold_b,
          (SELECT owner_player_id FROM card_instances WHERE card_instance_id = $3) AS owner_a,
          (SELECT owner_player_id FROM card_instances WHERE card_instance_id = $4) AS owner_b,
          (SELECT trade_lock FROM card_instances WHERE card_instance_id = $3) AS lock_a,
          (SELECT trade_lock FROM card_instances WHERE card_instance_id = $4) AS lock_b,
          (SELECT COUNT(*) FROM lineup_slots WHERE card_instance_id = $3) AS lineup_a,
          (SELECT COUNT(*) FROM economy_transactions
           WHERE reference_type = 'TRADE' AND reference_id = $5) AS ledger_count,
          (SELECT COUNT(*) FROM card_ownership_history
           WHERE reference_type = 'TRADE' AND reference_id = $5) AS history_count,
          (SELECT COUNT(*) FROM trade_cards
           WHERE trade_id = $6 AND outcome = 'TRANSFERRED') AS transferred_cards
      `,
      [
        playerAId,
        playerBId,
        cardA.instance.cardInstanceId,
        cardB.instance.cardInstanceId,
        tradeId,
        tradeId,
      ],
    );
    assert.equal(finalState.rows[0].gold_a, "440");
    assert.equal(finalState.rows[0].gold_b, "360");
    assert.equal(finalState.rows[0].owner_a, playerBId);
    assert.equal(finalState.rows[0].owner_b, playerAId);
    assert.equal(finalState.rows[0].lock_a, false);
    assert.equal(finalState.rows[0].lock_b, false);
    assert.equal(finalState.rows[0].lineup_a, "0");
    assert.equal(finalState.rows[0].ledger_count, "2");
    assert.equal(finalState.rows[0].history_count, "2");
    assert.equal(finalState.rows[0].transferred_cards, "2");

    const cancelCard = await cardInstanceService.mintCard(
      {
        cardTemplateId: template.cardTemplateId,
        ownerPlayerId: playerAId,
        cardLevel: 1,
        obtainedMethod: "ADMIN_GRANT",
      },
      { database },
    );
    const cancellable = await tradeService.createTrade(
      { initiatorPlayerId: playerAId, invitedPlayerId: playerBId },
      { database },
    );
    await tradeService.addCard(
      {
        tradeId: cancellable.trade.tradeId,
        playerId: playerAId,
        cardInstanceId: cancelCard.instance.cardInstanceId,
      },
      { database },
    );
    const cancelled = await tradeService.cancelTrade(
      { tradeId: cancellable.trade.tradeId, playerId: playerBId },
      { database },
    );
    assert.equal(cancelled.trade.status, "CANCELLED");
    const unlocked = await cardInstanceService.getInstance(
      cancelCard.instance.cardInstanceId,
      { database },
    );
    assert.equal(unlocked.tradeLock, false);

    const insufficientTrade = await tradeService.createTrade(
      { initiatorPlayerId: playerAId, invitedPlayerId: playerBId },
      { database },
    );
    await tradeService.setGoldOffer(
      {
        tradeId: insufficientTrade.trade.tradeId,
        playerId: playerAId,
        goldOffered: 1_000,
      },
      { database },
    );
    await tradeService.confirmTrade(
      { tradeId: insufficientTrade.trade.tradeId, playerId: playerBId },
      { database },
    );
    await database.query("SAVEPOINT insufficient_trade");
    await assert.rejects(
      tradeService.confirmTrade(
        { tradeId: insufficientTrade.trade.tradeId, playerId: playerAId },
        { database },
      ),
      (error) =>
        error instanceof TradeError && error.code === "INSUFFICIENT_GOLD",
    );
    await database.query("ROLLBACK TO SAVEPOINT insufficient_trade");
    const insufficientState = await tradeService.getTrade(
      { tradeId: insufficientTrade.trade.tradeId, playerId: playerAId },
      { database },
    );
    assert.equal(insufficientState.trade.status, "OPEN");
  } finally {
    await database.query("ROLLBACK");
    database.release();
    await pool.end();
  }
});
