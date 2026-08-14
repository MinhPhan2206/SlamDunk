import assert from "node:assert/strict";
import test from "node:test";

import { getDatabaseConfig } from "../src/config/env.js";
import { createPostgresPool } from "../src/database/connection/postgres.js";
import {
  createCardInstanceService,
  createCardTemplateService,
} from "../src/modules/card/index.js";
import { EconomyCurrency, createEconomyService } from "../src/modules/economy/index.js";
import { MarketError, createMarketService } from "../src/modules/market/index.js";
import { createPlayerService } from "../src/modules/player/index.js";

function templateInput(testRunId) {
  return {
    playerName: `M15 Test Player ${testRunId}`,
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

test("Market listing purchase atomically transfers Gold and card ownership", async () => {
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
  const marketService = createMarketService({
    databasePool: pool,
    cardInstanceService,
    economyService,
  });
  const testRunId = Date.now().toString();

  try {
    await database.query("BEGIN");
    const playersResult = await database.query(
      `
        INSERT INTO players (discord_user_id, username_snapshot)
        VALUES
          ($1, 'M15Seller'),
          ($2, 'M15Buyer'),
          ($3, 'M15SecondBuyer')
        RETURNING player_id, username_snapshot
      `,
      [`981${testRunId}`, `982${testRunId}`, `983${testRunId}`],
    );
    const players = new Map(
      playersResult.rows.map((row) => [row.username_snapshot, row.player_id]),
    );
    const sellerId = players.get("M15Seller");
    const buyerId = players.get("M15Buyer");
    const secondBuyerId = players.get("M15SecondBuyer");
    for (const playerId of [sellerId, buyerId, secondBuyerId]) {
      await economyService.ensureWallet(playerId, { database });
    }
    for (const [playerId, suffix] of [
      [buyerId, "buyer"],
      [secondBuyerId, "second-buyer"],
    ]) {
      await economyService.credit(
        {
          playerId,
          currency: EconomyCurrency.GOLD,
          amount: 1_000,
          transactionType: "ADMIN_ADJUSTMENT",
          referenceType: "M15_TEST",
          referenceId: testRunId,
          idempotencyKey: `m15:${testRunId}:${suffix}`,
        },
        { database },
      );
    }

    const template = await cardTemplateService.createTemplate(
      templateInput(testRunId),
      { database },
    );
    const firstCard = await cardInstanceService.mintCard(
      {
        cardTemplateId: template.cardTemplateId,
        ownerPlayerId: sellerId,
        cardLevel: 3,
        obtainedMethod: "ADMIN_GRANT",
      },
      { database },
    );
    const created = await marketService.createListing(
      {
        sellerPlayerId: sellerId,
        cardInstanceId: firstCard.instance.cardInstanceId,
        priceGold: 400,
      },
      { database },
    );
    const activeListings = await marketService.listActiveListings(
      { limit: 10 },
      { database },
    );
    assert.ok(
      activeListings.listings.some(
        (listing) => listing.listingId === created.listing.listingId,
      ),
    );

    const purchase = await marketService.buyListing(
      {
        buyerPlayerId: buyerId,
        publicCardId: firstCard.instance.publicCardId,
      },
      { database },
    );
    assert.equal(purchase.listing.status, "SOLD");
    assert.equal(purchase.card.ownerPlayerId, buyerId);
    assert.equal(purchase.card.ownershipCycles, 1);
    assert.equal(purchase.card.marketLock, false);
    assert.equal(purchase.economy.debit.transactionType, "MARKET_PURCHASE");
    assert.equal(purchase.economy.credit.transactionType, "MARKET_SALE");

    await assert.rejects(
      marketService.buyListing(
        { buyerPlayerId: secondBuyerId, listingId: created.listing.listingId },
        { database },
      ),
      (error) =>
        error instanceof MarketError && error.code === "LISTING_NOT_ACTIVE",
    );
    const state = await database.query(
      `
        SELECT
          (SELECT gold_balance FROM wallets WHERE player_id = $1) AS seller_gold,
          (SELECT gold_balance FROM wallets WHERE player_id = $2) AS buyer_gold,
          (SELECT gold_balance FROM wallets WHERE player_id = $3) AS second_buyer_gold,
          (SELECT COUNT(*) FROM card_ownership_history
           WHERE card_instance_id = $4 AND reason = 'MARKET') AS market_history
      `,
      [sellerId, buyerId, secondBuyerId, firstCard.instance.cardInstanceId],
    );
    assert.equal(state.rows[0].seller_gold, "400");
    assert.equal(state.rows[0].buyer_gold, "600");
    assert.equal(state.rows[0].second_buyer_gold, "1000");
    assert.equal(state.rows[0].market_history, "1");

    const secondCard = await cardInstanceService.mintCard(
      {
        cardTemplateId: template.cardTemplateId,
        ownerPlayerId: sellerId,
        cardLevel: 1,
        obtainedMethod: "ADMIN_GRANT",
      },
      { database },
    );
    const cancellable = await marketService.createListing(
      {
        sellerPlayerId: sellerId,
        cardInstanceId: secondCard.instance.cardInstanceId,
        priceGold: 250,
      },
      { database },
    );
    const cancellation = await marketService.cancelListing(
      {
        sellerPlayerId: sellerId,
        publicCardId: secondCard.instance.publicCardId,
      },
      { database },
    );
    assert.equal(cancellation.listing.status, "CANCELLED");
    const cancelledCard = await cardInstanceService.getInstance(
      secondCard.instance.cardInstanceId,
      { database },
    );
    assert.equal(cancelledCard.marketLock, false);

    const expiringCard = await cardInstanceService.mintCard(
      {
        cardTemplateId: template.cardTemplateId,
        ownerPlayerId: sellerId,
        cardLevel: 2,
        obtainedMethod: "ADMIN_GRANT",
      },
      { database },
    );
    const expiring = await marketService.createListing(
      {
        sellerPlayerId: sellerId,
        cardInstanceId: expiringCard.instance.cardInstanceId,
        priceGold: 300,
        durationCode: "1h",
      },
      { database },
    );
    await database.query(
      "UPDATE market_listings SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 second' WHERE listing_id = $1",
      [expiring.listing.listingId],
    );
    const expired = await marketService.expireDueListings({}, { database });
    assert.ok(expired.some((listing) => listing.listingId === expiring.listing.listingId));
    const expiredCard = await cardInstanceService.getInstance(
      expiringCard.instance.cardInstanceId,
      { database },
    );
    assert.equal(expiredCard.marketLock, false);
    const expiredState = await database.query(
      "SELECT status, expired_at FROM market_listings WHERE listing_id = $1",
      [expiring.listing.listingId],
    );
    assert.equal(expiredState.rows[0].status, "EXPIRED");
    assert.ok(expiredState.rows[0].expired_at);
  } finally {
    await database.query("ROLLBACK");
    database.release();
    await pool.end();
  }
});
