import assert from "node:assert/strict";
import test from "node:test";

import { getTestDatabaseConfig } from "../src/config/env.js";
import { gameConfig } from "../src/config/game-config.js";
import { createPostgresPool } from "../src/database/connection/postgres.js";
import {
  createCardInstanceService,
  createCardTemplateService,
} from "../src/modules/card/index.js";
import { EconomyCurrency, createEconomyService } from "../src/modules/economy/index.js";
import { createInventoryService } from "../src/modules/inventory/index.js";
import { createPlayerService } from "../src/modules/player/index.js";
import { TradeError, createTradeService } from "../src/modules/trade/index.js";

function templateInput(testRunId) {
  return {
    playerName: `M16 Test Player ${testRunId}`,
    primaryPosition: "SF",
    secondaryPosition: null,
    rarityCode: "UNCOMMON",
    overall: 85,
    finishing: 82,
    midRange: 84,
    threePoint: 81,
    playmaking: 76,
    perimeterDefense: 83,
    interiorDefense: 68,
    strength: 80,
    heightCm: null,
    packable: true,
  };
}

test("Direct Trade revisions support two-phase approval and atomic settlement", async () => {
  const pool = createPostgresPool({
    connectionString: getTestDatabaseConfig().databaseUrl,
  });
  const database = await pool.connect();
  const economyService = createEconomyService({ databasePool: pool });
  const playerService = createPlayerService({ databasePool: pool, economyService });
  const inventoryService = createInventoryService({
    databasePool: pool,
    itemDefinitions: gameConfig.items,
  });
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
    inventoryService,
    playerService,
    tradeConfig: { ...gameConfig.trade, reviewDelaySeconds: 0 },
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
    const acceptBoth = async (tradeId) => {
      await tradeService.acceptTrade(
        { tradeId, playerId: playerAId },
        { database },
      );
      return tradeService.acceptTrade(
        { tradeId, playerId: playerBId },
        { database },
      );
    };
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
    await inventoryService.grantItem(
      { playerId: playerAId, itemType: "LEVEL_UP", quantity: 3 },
      { database },
    );
    await inventoryService.grantItem(
      { playerId: playerBId, itemType: "ALPHA_CONTRACT", quantity: 2 },
      { database },
    );

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
    await assert.rejects(
      tradeService.setGoldOffer(
        { tradeId, playerId: playerAId, goldOffered: 1, operation: "ADD", offerRevision: 0 },
        { database },
      ),
      (error) =>
        error instanceof TradeError &&
        error.code === "TRADE_INVITATION_PENDING",
    );
    state = await acceptBoth(tradeId);
    assert.ok(state.participants.every((participant) => participant.acceptedAt));
    state = await tradeService.setCardOffer(
      {
        tradeId,
        playerId: playerAId,
        cardInstanceIds: [cardA.instance.cardInstanceId],
        operation: "ADD",
        offerRevision: state.trade.offerRevision,
      },
      { database },
    );
    state = await tradeService.setCardOffer(
      {
        tradeId,
        playerId: playerBId,
        cardInstanceIds: [cardB.instance.cardInstanceId],
        operation: "ADD",
        offerRevision: state.trade.offerRevision,
      },
      { database },
    );
    state = await tradeService.setGoldOffer(
      { tradeId, playerId: playerAId, goldOffered: 120, operation: "ADD", offerRevision: state.trade.offerRevision },
      { database },
    );
    state = await tradeService.setGoldOffer(
      { tradeId, playerId: playerAId, goldOffered: 20, operation: "REMOVE", offerRevision: state.trade.offerRevision },
      { database },
    );
    state = await tradeService.setItemOffer(
      {
        tradeId,
        playerId: playerAId,
        itemType: "LEVEL_UP",
        quantity: 1,
        operation: "ADD",
        offerRevision: state.trade.offerRevision,
      },
      { database },
    );
    state = await tradeService.setItemOffer(
      {
        tradeId,
        playerId: playerBId,
        itemType: "ALPHA_CONTRACT",
        quantity: 1,
        operation: "ADD",
        offerRevision: state.trade.offerRevision,
      },
      { database },
    );
    state = await tradeService.readyTrade(
      { tradeId, playerId: playerAId, offerRevision: state.trade.offerRevision },
      { database },
    );
    assert.equal(state.completed, false);
    await assert.rejects(
      tradeService.setGoldOffer(
        { tradeId, playerId: playerAId, goldOffered: 1, operation: "ADD", offerRevision: state.trade.offerRevision },
        { database },
      ),
      (error) => error instanceof TradeError && error.code === "TRADE_PLAYER_READY",
    );
    state = await tradeService.setGoldOffer(
      { tradeId, playerId: playerBId, goldOffered: 40, offerRevision: state.trade.offerRevision },
      { database },
    );
    assert.ok(state.participants.every((participant) => !participant.readyAt));

    await assert.rejects(
      tradeService.readyTrade(
        { tradeId, playerId: playerAId, offerRevision: state.trade.offerRevision - 1 },
        { database },
      ),
      (error) => error instanceof TradeError && error.code === "TRADE_OFFER_CHANGED",
    );
    state = await tradeService.readyTrade(
      { tradeId, playerId: playerAId, offerRevision: state.trade.offerRevision },
      { database },
    );
    state = await tradeService.undoReady(
      { tradeId, playerId: playerAId, offerRevision: state.trade.offerRevision },
      { database },
    );
    assert.ok(state.participants.every((participant) => !participant.readyAt));
    state = await tradeService.readyTrade(
      { tradeId, playerId: playerAId, offerRevision: state.trade.offerRevision },
      { database },
    );
    state = await tradeService.readyTrade(
      { tradeId, playerId: playerBId, offerRevision: state.trade.offerRevision },
      { database },
    );
    assert.ok(state.trade.reviewStartedAt);
    state = await tradeService.undoReady(
      { tradeId, playerId: playerAId, offerRevision: state.trade.offerRevision },
      { database },
    );
    assert.equal(state.trade.reviewStartedAt, null);
    assert.ok(state.participants.every((participant) => !participant.readyAt));
    state = await tradeService.readyTrade(
      { tradeId, playerId: playerAId, offerRevision: state.trade.offerRevision },
      { database },
    );
    state = await tradeService.readyTrade(
      { tradeId, playerId: playerBId, offerRevision: state.trade.offerRevision },
      { database },
    );
    state = await tradeService.finalAcceptTrade(
      { tradeId, playerId: playerAId, offerRevision: state.trade.offerRevision },
      { database },
    );
    assert.equal(state.completed, false);
    state = await tradeService.finalAcceptTrade(
      { tradeId, playerId: playerBId, offerRevision: state.trade.offerRevision },
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
           WHERE trade_id = $6 AND outcome = 'TRANSFERRED') AS transferred_cards,
          (SELECT quantity FROM player_items
           WHERE player_id = $1 AND item_type = 'LEVEL_UP') AS level_up_a,
          (SELECT quantity FROM player_items
           WHERE player_id = $2 AND item_type = 'LEVEL_UP') AS level_up_b,
          (SELECT quantity FROM player_items
           WHERE player_id = $1 AND item_type = 'ALPHA_CONTRACT') AS alpha_a,
          (SELECT quantity FROM player_items
           WHERE player_id = $2 AND item_type = 'ALPHA_CONTRACT') AS alpha_b,
          (SELECT COUNT(*) FROM trade_items
           WHERE trade_id = $6 AND outcome = 'TRANSFERRED') AS transferred_items
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
    assert.equal(finalState.rows[0].level_up_a, 2);
    assert.equal(finalState.rows[0].level_up_b, 1);
    assert.equal(finalState.rows[0].alpha_a, 1);
    assert.equal(finalState.rows[0].alpha_b, 1);
    assert.equal(finalState.rows[0].transferred_items, "2");

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
    await acceptBoth(cancellable.trade.tradeId);
    let cancellableState = await tradeService.addCard(
      {
        tradeId: cancellable.trade.tradeId,
        playerId: playerAId,
        cardInstanceId: cancelCard.instance.cardInstanceId,
        offerRevision: cancellable.trade.offerRevision,
      },
      { database },
    );
    cancellableState = await tradeService.setItemOffer(
      {
        tradeId: cancellable.trade.tradeId,
        playerId: playerAId,
        itemType: "LEVEL_UP",
        quantity: 1,
        operation: "ADD",
        offerRevision: cancellableState.trade.offerRevision,
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
    assert.equal(
      (await inventoryService.listItems(playerAId, { database }))
        .find((item) => item.itemType === "LEVEL_UP").quantity,
      2,
    );

    const expiryCard = await cardInstanceService.mintCard(
      {
        cardTemplateId: template.cardTemplateId,
        ownerPlayerId: playerAId,
        cardLevel: 1,
        obtainedMethod: "ADMIN_GRANT",
      },
      { database },
    );
    const expiring = await tradeService.createTrade(
      { initiatorPlayerId: playerAId, invitedPlayerId: playerBId },
      { database },
    );
    await acceptBoth(expiring.trade.tradeId);
    let expiringState = await tradeService.addCard(
      {
        tradeId: expiring.trade.tradeId,
        playerId: playerAId,
        cardInstanceId: expiryCard.instance.cardInstanceId,
        offerRevision: expiring.trade.offerRevision,
      },
      { database },
    );
    expiringState = await tradeService.setItemOffer(
      {
        tradeId: expiring.trade.tradeId,
        playerId: playerAId,
        itemType: "ALPHA_CONTRACT",
        quantity: 1,
        operation: "ADD",
        offerRevision: expiringState.trade.offerRevision,
      },
      { database },
    );
    const expired = await tradeService.expireTrade(
      { tradeId: expiring.trade.tradeId },
      { database },
    );
    assert.equal(expired.trade.status, "EXPIRED");
    assert.equal(
      (await cardInstanceService.getInstance(expiryCard.instance.cardInstanceId, { database })).tradeLock,
      false,
    );
    assert.equal(
      (await inventoryService.listItems(playerAId, { database }))
        .find((item) => item.itemType === "ALPHA_CONTRACT").quantity,
      1,
    );

    await assert.rejects(
      tradeService.setGoldOffer(
        { tradeId: cancellable.trade.tradeId, playerId: playerAId, goldOffered: 20_000_001, offerRevision: 0 },
        { database },
      ),
      (error) => error instanceof TradeError && error.code === "TRADE_GOLD_LIMIT",
    );

    const insufficientTrade = await tradeService.createTrade(
      { initiatorPlayerId: playerAId, invitedPlayerId: playerBId },
      { database },
    );
    await acceptBoth(insufficientTrade.trade.tradeId);
    await tradeService.setGoldOffer(
      {
        tradeId: insufficientTrade.trade.tradeId,
        playerId: playerAId,
        goldOffered: 1_000,
        offerRevision: insufficientTrade.trade.offerRevision,
      },
      { database },
    );
    let insufficientState = await tradeService.getTrade(
      { tradeId: insufficientTrade.trade.tradeId, playerId: playerAId },
      { database },
    );
    insufficientState = await tradeService.readyTrade(
      { tradeId: insufficientTrade.trade.tradeId, playerId: playerBId, offerRevision: insufficientState.trade.offerRevision },
      { database },
    );
    insufficientState = await tradeService.readyTrade(
      { tradeId: insufficientTrade.trade.tradeId, playerId: playerAId, offerRevision: insufficientState.trade.offerRevision },
      { database },
    );
    insufficientState = await tradeService.finalAcceptTrade(
      { tradeId: insufficientTrade.trade.tradeId, playerId: playerBId, offerRevision: insufficientState.trade.offerRevision },
      { database },
    );
    await database.query("SAVEPOINT insufficient_trade");
    await assert.rejects(
      tradeService.finalAcceptTrade(
        { tradeId: insufficientTrade.trade.tradeId, playerId: playerAId, offerRevision: insufficientState.trade.offerRevision },
        { database },
      ),
      (error) =>
        error instanceof TradeError && error.code === "INSUFFICIENT_GOLD",
    );
    await database.query("ROLLBACK TO SAVEPOINT insufficient_trade");
    insufficientState = await tradeService.getTrade(
      { tradeId: insufficientTrade.trade.tradeId, playerId: playerAId },
      { database },
    );
    assert.equal(insufficientState.trade.status, "OPEN");

    const delayedTradeService = createTradeService({
      databasePool: pool,
      cardInstanceService,
      economyService,
      inventoryService,
      playerService,
      tradeConfig: { ...gameConfig.trade, reviewDelaySeconds: 5 },
    });
    let delayedState = await delayedTradeService.createTrade(
      { initiatorPlayerId: playerAId, invitedPlayerId: playerBId },
      { database },
    );
    await delayedTradeService.acceptTrade(
      { tradeId: delayedState.trade.tradeId, playerId: playerAId },
      { database },
    );
    delayedState = await delayedTradeService.acceptTrade(
      { tradeId: delayedState.trade.tradeId, playerId: playerBId },
      { database },
    );
    delayedState = await delayedTradeService.setGoldOffer(
      { tradeId: delayedState.trade.tradeId, playerId: playerAId, goldOffered: 1, offerRevision: delayedState.trade.offerRevision },
      { database },
    );
    delayedState = await delayedTradeService.readyTrade(
      { tradeId: delayedState.trade.tradeId, playerId: playerAId, offerRevision: delayedState.trade.offerRevision },
      { database },
    );
    delayedState = await delayedTradeService.readyTrade(
      { tradeId: delayedState.trade.tradeId, playerId: playerBId, offerRevision: delayedState.trade.offerRevision },
      { database },
    );
    await assert.rejects(
      delayedTradeService.finalAcceptTrade(
        { tradeId: delayedState.trade.tradeId, playerId: playerAId, offerRevision: delayedState.trade.offerRevision },
        { database },
      ),
      (error) => error instanceof TradeError && error.code === "TRADE_REVIEW_DELAY",
    );
  } finally {
    await database.query("ROLLBACK");
    database.release();
    await pool.end();
  }
});
