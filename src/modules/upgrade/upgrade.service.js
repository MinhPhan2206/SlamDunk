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
    async listFusionOptions({ playerId }, { database = databasePool } = {}) {
      const normalizedPlayerId = normalizeId(playerId, "playerId");
      return Object.freeze(
        await upgradeRepository.listFusionGroups(database, normalizedPlayerId),
      );
    },

    async previewFusionMaterials(
      { playerId, cardTemplateId },
      { database = databasePool } = {},
    ) {
      const normalizedPlayerId = normalizeId(playerId, "playerId");
      const normalizedCardTemplateId = normalizeId(cardTemplateId, "cardTemplateId");
      const cards = await upgradeRepository.listFusionCards(database, {
        playerId: normalizedPlayerId,
        cardTemplateId: normalizedCardTemplateId,
      });
      if (cards.length < 2) {
        throw new UpgradeError(
          "FUSION_MATERIAL_MISSING",
          "You need at least two eligible copies of this card.",
        );
      }
      return Object.freeze({
        group: Object.freeze({
          cardTemplateId: cards[0].cardTemplateId,
          playerName: cards[0].playerName,
          primaryPosition: cards[0].primaryPosition,
          secondaryPosition: cards[0].secondaryPosition,
          rarityCode: cards[0].rarityCode,
          rarityName: cards[0].rarityName,
          cardCount: cards.length,
        }),
        cards: Object.freeze(cards),
      });
    },

    async previewLevelUp(
      { playerId, cardInstanceId },
      { database } = {},
    ) {
      const normalizedPlayerId = normalizeId(playerId, "playerId");
      const normalizedCardInstanceId = normalizeId(cardInstanceId, "cardInstanceId");
      return useTransaction(databasePool, database, async (transactionDatabase) => {
        const [card] = await upgradeRepository.findCardsForUpdate(
          transactionDatabase,
          [normalizedCardInstanceId],
        );
        if (!card) {
          throw new UpgradeError("CARD_NOT_FOUND", "Card was not found.");
        }
        assertOwnedActiveUnlocked(card, normalizedPlayerId);
        if (card.cardLevel >= upgradeConfig.maximumCardLevel) {
          throw new UpgradeError("CARD_MAX_LEVEL", "This card is already Level 5.");
        }
        const itemQuantity = await upgradeRepository.findItemQuantity(
          transactionDatabase,
          { playerId: normalizedPlayerId, itemType: upgradeConfig.levelUpItemType },
        );
        if (itemQuantity < 1) {
          throw new UpgradeError(
            "LEVEL_UP_ITEM_MISSING",
            `You do not have a ${upgradeConfig.levelUpItemName} item.`,
          );
        }
        return Object.freeze({
          card,
          previousLevel: card.cardLevel,
          newLevel: card.cardLevel + 1,
        });
      });
    },

    async fuseCards(
      { playerId, sourceCardIds },
      { database } = {},
    ) {
      const normalizedPlayerId = normalizeId(playerId, "playerId");
      if (!Array.isArray(sourceCardIds) || sourceCardIds.length < 2 || sourceCardIds.length > 5) {
        throw new UpgradeError(
          "FUSION_SOURCE_COUNT",
          "Fusion requires between two and five Card Instances.",
        );
      }
      const sourceIds = sourceCardIds.map((sourceCardId) =>
        normalizeId(sourceCardId, "sourceCardId"));
      if (new Set(sourceIds).size !== sourceIds.length) {
        throw new UpgradeError(
          "FUSION_DUPLICATE_INSTANCE",
          "Each Fusion material must be a different Card Instance.",
        );
      }

      return useTransaction(databasePool, database, async (transactionDatabase) => {
        const sourceCards = await upgradeRepository.findCardsForUpdate(
          transactionDatabase,
          sourceIds,
        );

        if (sourceCards.length !== sourceIds.length) {
          throw new UpgradeError(
            "FUSION_CARD_NOT_FOUND",
            "One or more Fusion cards were not found.",
          );
        }
        for (const card of sourceCards) {
          assertOwnedActiveUnlocked(card, normalizedPlayerId);
          if (card.inLineup) {
            throw new UpgradeError(
              "CARD_IN_LINEUP",
              "Remove every selected card from your lineup before fusing them.",
            );
          }
        }
        if (sourceCards.some(
          (card) => card.cardTemplateId !== sourceCards[0].cardTemplateId,
        )) {
          throw new UpgradeError(
            "FUSION_TEMPLATE_MISMATCH",
            "Fusion cards must use the same Card Template.",
          );
        }

        const resultLevel = Math.min(
          sourceCards.reduce((total, card) => total + card.cardLevel, 0),
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
            sourceCards.length,
          );

        if (destroyedCount !== sourceCards.length || circulationAfterDestruction == null) {
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
