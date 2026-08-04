import { withTransaction } from "../../database/transaction/transaction-manager.js";
import { EconomyCurrency } from "../economy/index.js";
import { QuicksellError } from "./quicksell.errors.js";
import { quicksellRepository } from "./quicksell.repository.js";

function normalizeId(value, fieldName) {
  const normalized = String(value);

  if (!/^\d+$/.test(normalized) || BigInt(normalized) <= 0n) {
    throw new TypeError(`${fieldName} must be a positive integer.`);
  }

  return normalized;
}

function validateRewards(shardRewards) {
  for (let rarityTier = 1; rarityTier <= 7; rarityTier += 1) {
    if (!Number.isSafeInteger(shardRewards?.[rarityTier]) || shardRewards[rarityTier] <= 0) {
      throw new TypeError(`Missing quicksell reward for rarity Tier ${rarityTier}.`);
    }
  }
}

export function createQuicksellService({
  databasePool,
  economyService,
  quicksellConfig,
}) {
  validateRewards(quicksellConfig?.shardRewards);

  return Object.freeze({
    async quicksell({ playerId, cardInstanceId }, { database } = {}) {
      const normalizedPlayerId = normalizeId(playerId, "playerId");
      const normalizedCardInstanceId = normalizeId(
        cardInstanceId,
        "cardInstanceId",
      );

      const operation = async (transactionDatabase) => {
        const card = await quicksellRepository.findCardForUpdate(
          transactionDatabase,
          normalizedCardInstanceId,
        );

        if (!card) {
          throw new QuicksellError("CARD_NOT_FOUND", "Card was not found.");
        }
        if (card.ownerPlayerId !== normalizedPlayerId) {
          throw new QuicksellError(
            "CARD_NOT_OWNED",
            "You do not own this card.",
          );
        }
        if (card.status !== "ACTIVE") {
          throw new QuicksellError(
            "CARD_NOT_ACTIVE",
            "Only an active card can be quicksold.",
          );
        }
        if (card.marketLock || card.tradeLock) {
          throw new QuicksellError(
            "CARD_LOCKED",
            "A market- or trade-locked card cannot be quicksold.",
          );
        }
        if (card.inLineup) {
          throw new QuicksellError(
            "CARD_IN_LINEUP",
            "Remove this card from your lineup before quickselling it.",
          );
        }

        const shardReward = quicksellConfig.shardRewards[card.rarityTier];
        await quicksellRepository.destroyCard(
          transactionDatabase,
          card.cardInstanceId,
        );
        const currentCirculation =
          await quicksellRepository.decrementCirculation(
            transactionDatabase,
            card.cardTemplateId,
          );

        if (currentCirculation == null) {
          throw new QuicksellError(
            "CIRCULATION_INVARIANT",
            "Card circulation could not be updated.",
          );
        }

        await quicksellRepository.createOwnershipEvent(transactionDatabase, {
          cardInstanceId: card.cardInstanceId,
          playerId: normalizedPlayerId,
        });
        const economy = await economyService.credit(
          {
            playerId: normalizedPlayerId,
            currency: EconomyCurrency.SHARDS,
            amount: shardReward,
            transactionType: "QUICKSELL",
            referenceType: "CARD_INSTANCE",
            referenceId: card.cardInstanceId,
            idempotencyKey: `quicksell:${card.cardInstanceId}`,
          },
          { database: transactionDatabase },
        );

        return Object.freeze({
          card,
          shardReward,
          shardBalance: economy.balanceAfter,
        });
      };

      return database
        ? operation(database)
        : withTransaction(databasePool, operation);
    },
  });
}
