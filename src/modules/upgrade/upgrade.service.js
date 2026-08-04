import { withTransaction } from "../../database/transaction/transaction-manager.js";
import { UpgradeError } from "./upgrade.errors.js";
import { upgradeRepository } from "./upgrade.repository.js";

function normalizeId(value, fieldName) {
  const normalized = String(value);

  if (!/^\d+$/.test(normalized) || BigInt(normalized) <= 0n) {
    throw new TypeError(`${fieldName} must be a positive integer.`);
  }

  return normalized;
}

function validateConfig(config) {
  if (config?.maximumCardLevel !== 5) {
    throw new TypeError("maximumCardLevel must be 5.");
  }
  if (typeof config.levelUpItemType !== "string" || !config.levelUpItemType) {
    throw new TypeError("levelUpItemType is required.");
  }
  if (typeof config.levelUpItemName !== "string" || !config.levelUpItemName) {
    throw new TypeError("levelUpItemName is required.");
  }
}

function assertOwnedActiveUnlocked(card, playerId) {
  if (card.ownerPlayerId !== playerId) {
    throw new UpgradeError("CARD_NOT_OWNED", "You do not own this card.");
  }
  if (card.status !== "ACTIVE") {
    throw new UpgradeError(
      "CARD_NOT_ACTIVE",
      "Only active cards can be upgraded.",
    );
  }
  if (card.marketLock || card.tradeLock) {
    throw new UpgradeError(
      "CARD_LOCKED",
      "A market- or trade-locked card cannot be upgraded.",
    );
  }
}

function useTransaction(databasePool, database, operation) {
  return database
    ? operation(database)
    : withTransaction(databasePool, operation);
}

export function createUpgradeService({
  databasePool,
  cardInstanceService,
  upgradeConfig,
}) {
  validateConfig(upgradeConfig);

  return Object.freeze({
    async fuseCards(
      { playerId, sourceCardAId, sourceCardBId },
      { database } = {},
    ) {
      const normalizedPlayerId = normalizeId(playerId, "playerId");
      const sourceIds = [
        normalizeId(sourceCardAId, "sourceCardAId"),
        normalizeId(sourceCardBId, "sourceCardBId"),
      ];

      if (sourceIds[0] === sourceIds[1]) {
        throw new UpgradeError(
          "FUSION_SAME_INSTANCE",
          "Fusion requires two different Card Instances.",
        );
      }

      return useTransaction(databasePool, database, async (transactionDatabase) => {
        const sourceCards = await upgradeRepository.findCardsForUpdate(
          transactionDatabase,
          sourceIds,
        );

        if (sourceCards.length !== 2) {
          throw new UpgradeError(
            "FUSION_CARD_NOT_FOUND",
            "One or both Fusion cards were not found.",
          );
        }
        for (const card of sourceCards) {
          assertOwnedActiveUnlocked(card, normalizedPlayerId);
          if (card.inLineup) {
            throw new UpgradeError(
              "CARD_IN_LINEUP",
              "Remove both cards from your lineup before fusing them.",
            );
          }
        }
        if (sourceCards[0].cardTemplateId !== sourceCards[1].cardTemplateId) {
          throw new UpgradeError(
            "FUSION_TEMPLATE_MISMATCH",
            "Fusion cards must use the same Card Template.",
          );
        }

        const resultLevel = Math.min(
          sourceCards[0].cardLevel + sourceCards[1].cardLevel,
          upgradeConfig.maximumCardLevel,
        );
        const destroyedCount = await upgradeRepository.destroyFusionSources(
          transactionDatabase,
          sourceIds,
        );
        const circulationAfterDestruction =
          await upgradeRepository.decrementCirculation(
            transactionDatabase,
            sourceCards[0].cardTemplateId,
          );

        if (destroyedCount !== 2 || circulationAfterDestruction == null) {
          throw new UpgradeError(
            "FUSION_INVARIANT",
            "Fusion source state could not be updated.",
          );
        }

        const mint = await cardInstanceService.mintCard(
          {
            cardTemplateId: sourceCards[0].cardTemplateId,
            ownerPlayerId: normalizedPlayerId,
            cardLevel: resultLevel,
            obtainedMethod: "FUSION",
          },
          { database: transactionDatabase },
        );
        const fusion = await upgradeRepository.createFusion(
          transactionDatabase,
          {
            playerId: normalizedPlayerId,
            resultCardInstanceId: mint.instance.cardInstanceId,
            resultLevel,
          },
        );
        await upgradeRepository.createFusionSources(
          transactionDatabase,
          fusion.fusionId,
          sourceCards,
        );
        await upgradeRepository.createFusionOwnershipEvents(
          transactionDatabase,
          { fusionId: fusion.fusionId, playerId: normalizedPlayerId, sourceCards },
        );

        return Object.freeze({
          fusion,
          sourceCards: Object.freeze(sourceCards),
          resultCard: mint.instance,
        });
      });
    },

    async useLevelUpItem({ playerId, cardInstanceId }, { database } = {}) {
      const normalizedPlayerId = normalizeId(playerId, "playerId");
      const normalizedCardInstanceId = normalizeId(
        cardInstanceId,
        "cardInstanceId",
      );

      return useTransaction(databasePool, database, async (transactionDatabase) => {
        const cards = await upgradeRepository.findCardsForUpdate(
          transactionDatabase,
          [normalizedCardInstanceId],
        );
        const card = cards[0];

        if (!card) {
          throw new UpgradeError("CARD_NOT_FOUND", "Card was not found.");
        }
        assertOwnedActiveUnlocked(card, normalizedPlayerId);
        if (card.cardLevel >= upgradeConfig.maximumCardLevel) {
          throw new UpgradeError(
            "CARD_MAX_LEVEL",
            "This card is already Level 5.",
          );
        }

        const itemQuantity = await upgradeRepository.ensureItemRowForUpdate(
          transactionDatabase,
          {
            playerId: normalizedPlayerId,
            itemType: upgradeConfig.levelUpItemType,
          },
        );
        if (itemQuantity < 1) {
          throw new UpgradeError(
            "LEVEL_UP_ITEM_MISSING",
            `You do not have a ${upgradeConfig.levelUpItemName} item.`,
          );
        }

        const remainingItems = await upgradeRepository.consumeItem(
          transactionDatabase,
          {
            playerId: normalizedPlayerId,
            itemType: upgradeConfig.levelUpItemType,
          },
        );
        const newLevel = await upgradeRepository.incrementCardLevel(
          transactionDatabase,
          card.cardInstanceId,
        );

        if (remainingItems == null || newLevel == null) {
          throw new UpgradeError(
            "UPGRADE_INVARIANT",
            "The card or item state could not be updated.",
          );
        }

        await upgradeRepository.createUpgradeUsage(transactionDatabase, {
          playerId: normalizedPlayerId,
          cardInstanceId: card.cardInstanceId,
          previousLevel: card.cardLevel,
          newLevel,
          itemType: upgradeConfig.levelUpItemType,
        });

        return Object.freeze({
          card,
          previousLevel: card.cardLevel,
          newLevel,
          itemName: upgradeConfig.levelUpItemName,
          remainingItems,
        });
      });
    },
  });
}
