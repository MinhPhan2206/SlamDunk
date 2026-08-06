import { withTransaction } from "../../database/transaction/transaction-manager.js";
import { CardError } from "../card/index.js";
import { EconomyCurrency, EconomyError } from "../economy/index.js";
import { MarketError } from "./market.errors.js";
import { marketRepository } from "./market.repository.js";

const MAX_BIGINT = 9_223_372_036_854_775_807n;
const MARKET_PAGE_SIZE = 10;

function normalizeId(value, fieldName) {
  const normalized = String(value);
  if (!/^\d+$/.test(normalized) || BigInt(normalized) <= 0n) {
    throw new TypeError(`${fieldName} must be a positive integer.`);
  }
  return normalized;
}

function normalizePrice(value) {
  if (
    typeof value !== "bigint" &&
    !(typeof value === "string" && /^\d+$/.test(value)) &&
    !(typeof value === "number" && Number.isSafeInteger(value))
  ) {
    throw new TypeError("priceGold must be a positive integer.");
  }
  const price = BigInt(value);
  if (price <= 0n || price > MAX_BIGINT) {
    throw new TypeError("priceGold must be a positive 64-bit integer.");
  }
  return price.toString();
}

function useTransaction(databasePool, database, operation) {
  return database
    ? operation(database)
    : withTransaction(databasePool, operation);
}

function listingNotActive() {
  return new MarketError(
    "LISTING_NOT_ACTIVE",
    "This Market listing is no longer active.",
  );
}

export function createMarketService({
  databasePool,
  cardInstanceService,
  economyService,
}) {
  return Object.freeze({
    async createListing(
      { sellerPlayerId, cardInstanceId, priceGold },
      { database } = {},
    ) {
      const sellerId = normalizeId(sellerPlayerId, "sellerPlayerId");
      const cardId = normalizeId(cardInstanceId, "cardInstanceId");
      const price = normalizePrice(priceGold);

      return useTransaction(databasePool, database, async (transactionDatabase) => {
        let card;
        try {
          card = await cardInstanceService.lockForMarket(
            { cardInstanceId: cardId, ownerPlayerId: sellerId },
            { database: transactionDatabase },
          );
        } catch (error) {
          if (error instanceof CardError) {
            throw new MarketError("CARD_NOT_AVAILABLE", error.message);
          }
          throw error;
        }

        try {
          const listing = await marketRepository.createListing(
            transactionDatabase,
            {
              sellerPlayerId: sellerId,
              cardInstanceId: cardId,
              priceGold: price,
            },
          );
          return Object.freeze({ listing, card });
        } catch (error) {
          if (error?.code === "23505") {
            throw new MarketError(
              "DUPLICATE_LISTING",
              "This card already has an active Market listing.",
            );
          }
          throw error;
        }
      });
    },

    async cancelListing({ sellerPlayerId, listingId }, { database } = {}) {
      const sellerId = normalizeId(sellerPlayerId, "sellerPlayerId");
      const normalizedListingId = normalizeId(listingId, "listingId");

      return useTransaction(databasePool, database, async (transactionDatabase) => {
        const listing = await marketRepository.findByIdForUpdate(
          transactionDatabase,
          normalizedListingId,
        );
        if (!listing) {
          throw new MarketError("LISTING_NOT_FOUND", "Market listing was not found.");
        }
        if (listing.sellerPlayerId !== sellerId) {
          throw new MarketError(
            "LISTING_NOT_OWNED",
            "Only the seller can cancel this listing.",
          );
        }
        if (listing.status !== "ACTIVE") {
          throw listingNotActive();
        }

        try {
          await cardInstanceService.unlockFromMarket(
            {
              cardInstanceId: listing.cardInstanceId,
              ownerPlayerId: sellerId,
            },
            { database: transactionDatabase },
          );
        } catch (error) {
          if (error instanceof CardError) {
            throw new MarketError("MARKET_LOCK_INVALID", error.message);
          }
          throw error;
        }
        const cancelledListing = await marketRepository.markCancelled(
          transactionDatabase,
          listing.listingId,
        );
        if (!cancelledListing) {
          throw listingNotActive();
        }
        return Object.freeze({ listing: cancelledListing });
      });
    },

    async listActiveListings(
      { page = 1 } = {},
      { database = databasePool } = {},
    ) {
      if (!Number.isSafeInteger(page) || page < 1 || page > 1_000_000) {
        throw new TypeError("page must be a positive safe integer.");
      }
      const result = await marketRepository.listActive(database, {
        limit: MARKET_PAGE_SIZE,
        offset: (page - 1) * MARKET_PAGE_SIZE,
      });
      const totalPages = Number(
        (BigInt(result.total) + BigInt(MARKET_PAGE_SIZE) - 1n) /
          BigInt(MARKET_PAGE_SIZE),
      );
      return Object.freeze({
        listings: Object.freeze(result.listings),
        total: result.total,
        page,
        pageSize: MARKET_PAGE_SIZE,
        totalPages,
      });
    },

    async buyListing({ buyerPlayerId, listingId }, { database } = {}) {
      const buyerId = normalizeId(buyerPlayerId, "buyerPlayerId");
      const normalizedListingId = normalizeId(listingId, "listingId");

      return useTransaction(databasePool, database, async (transactionDatabase) => {
        const listing = await marketRepository.findByIdForUpdate(
          transactionDatabase,
          normalizedListingId,
        );
        if (!listing) {
          throw new MarketError("LISTING_NOT_FOUND", "Market listing was not found.");
        }
        if (listing.status !== "ACTIVE") {
          throw listingNotActive();
        }
        if (listing.sellerPlayerId === buyerId) {
          throw new MarketError(
            "CANNOT_BUY_OWN_LISTING",
            "You cannot buy your own Market listing.",
          );
        }

        const card = await cardInstanceService.getInstanceForUpdate(
          listing.cardInstanceId,
          { database: transactionDatabase },
        );
        if (
          card.ownerPlayerId !== listing.sellerPlayerId ||
          card.status !== "ACTIVE" ||
          !card.marketLock ||
          card.tradeLock
        ) {
          throw new MarketError(
            "LISTING_CARD_INVALID",
            "The listed card is no longer available.",
          );
        }

        let economy;
        try {
          economy = await economyService.transfer(
            {
              fromPlayerId: buyerId,
              toPlayerId: listing.sellerPlayerId,
              currency: EconomyCurrency.GOLD,
              amount: listing.priceGold,
              debitTransactionType: "MARKET_PURCHASE",
              creditTransactionType: "MARKET_SALE",
              referenceType: "MARKET_LISTING",
              referenceId: listing.listingId,
              idempotencyKey: `market:${listing.listingId}`,
            },
            { database: transactionDatabase },
          );
        } catch (error) {
          if (
            error instanceof EconomyError &&
            error.code === "INSUFFICIENT_GOLD"
          ) {
            throw new MarketError(
              "INSUFFICIENT_GOLD",
              "You do not have enough Gold for this listing.",
            );
          }
          throw error;
        }

        const ownership = await cardInstanceService.transferMarketOwnership(
          {
            cardInstanceId: listing.cardInstanceId,
            fromPlayerId: listing.sellerPlayerId,
            toPlayerId: buyerId,
            listingId: listing.listingId,
          },
          { database: transactionDatabase },
        );
        const soldListing = await marketRepository.markSold(
          transactionDatabase,
          { listingId: listing.listingId, buyerPlayerId: buyerId },
        );
        if (!soldListing) {
          throw listingNotActive();
        }

        return Object.freeze({
          listing: soldListing,
          card: ownership.instance,
          economy,
        });
      });
    },
  });
}
