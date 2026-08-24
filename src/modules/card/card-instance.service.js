import { randomInt } from "node:crypto";

import { withTransaction } from "../../database/transaction/transaction-manager.js";
import { CardError } from "./card.errors.js";
import { cardInstanceRepository } from "./card-instance.repository.js";
import { cardMintCounterRepository } from "./card-mint-counter.repository.js";
import { cardOwnershipRepository } from "./card-ownership.repository.js";

const CREATION_REASONS = Object.freeze({
  DROP: "DROP",
  PACK: "PACK",
  FUSION: "FUSION_CREATED",
  ADMIN_GRANT: "ADMIN_TRANSFER",
  EVENT_REWARD: "EVENT_REWARD",
});
const REFERENCE_TYPE_PATTERN = /^[A-Z][A-Z0-9_]*$/;
const PUBLIC_CARD_ID_MINIMUM = 100_000_000;
const PUBLIC_CARD_ID_MAXIMUM_EXCLUSIVE = 1_000_000_000;
const PUBLIC_CARD_ID_ATTEMPTS = 10;

function normalizeId(value, fieldName) {
  const normalized = String(value);

  if (!/^\d+$/.test(normalized) || BigInt(normalized) <= 0n) {
    throw new TypeError(`${fieldName} must be a positive integer.`);
  }

  return normalized;
}

function normalizeCardLevel(cardLevel) {
  if (!Number.isInteger(cardLevel) || cardLevel < 1 || cardLevel > 5) {
    throw new TypeError("cardLevel must be an integer from 1 through 5.");
  }

  return cardLevel;
}

function normalizeObtainedMethod(obtainedMethod) {
  if (!Object.hasOwn(CREATION_REASONS, obtainedMethod)) {
    throw new TypeError(
      "obtainedMethod must be DROP, PACK, FUSION, ADMIN_GRANT, or EVENT_REWARD.",
    );
  }

  return obtainedMethod;
}

function normalizeReference(referenceType, referenceId) {
  if (referenceType == null && referenceId == null) {
    return Object.freeze({ referenceType: null, referenceId: null });
  }

  if (
    typeof referenceType !== "string" ||
    !REFERENCE_TYPE_PATTERN.test(referenceType) ||
    typeof referenceId !== "string" ||
    referenceId.trim().length === 0
  ) {
    throw new TypeError(
      "referenceType must be an uppercase code and referenceId must be non-empty.",
    );
  }

  return Object.freeze({
    referenceType,
    referenceId: referenceId.trim(),
  });
}

function normalizeMintInput(input) {
  if (!input || typeof input !== "object") {
    throw new TypeError("Card mint input is required.");
  }

  return Object.freeze({
    cardTemplateId: normalizeId(input.cardTemplateId, "cardTemplateId"),
    ownerPlayerId: normalizeId(input.ownerPlayerId, "ownerPlayerId"),
    cardLevel: normalizeCardLevel(input.cardLevel),
    obtainedMethod: normalizeObtainedMethod(input.obtainedMethod),
    accountBound: input.accountBound === true,
    ...normalizeReference(input.referenceType, input.referenceId),
  });
}

async function useTransaction(databasePool, database, operation) {
  if (database) {
    return operation(database);
  }

  return withTransaction(databasePool, operation);
}

export function createCardInstanceService({
  databasePool,
  cardTemplateService,
  playerService,
  generatePublicCardId = () =>
    randomInt(PUBLIC_CARD_ID_MINIMUM, PUBLIC_CARD_ID_MAXIMUM_EXCLUSIVE),
}) {
  async function getInstance(
    cardInstanceId,
    { database = databasePool } = {},
  ) {
    const instance = await cardInstanceRepository.findById(
      database,
      normalizeId(cardInstanceId, "cardInstanceId"),
    );

    if (!instance) {
      throw new CardError(
        "CARD_INSTANCE_NOT_FOUND",
        "Card Instance was not found.",
      );
    }

    return instance;
  }

  async function validateMints(transactionDatabase, mints) {
    const templateIds = [...new Set(mints.map((mint) => mint.cardTemplateId))];
    for (const cardTemplateId of templateIds) {
      await cardTemplateService.getTemplate(cardTemplateId, {
        database: transactionDatabase,
      });
    }

    const ownerIds = [...new Set(mints.map((mint) => mint.ownerPlayerId))];
    for (const ownerPlayerId of ownerIds) {
      const owner = await playerService.getPlayerById(ownerPlayerId, {
        database: transactionDatabase,
      });
      if (!owner) {
        throw new CardError(
          "PLAYER_NOT_FOUND",
          "Card owner Player was not found.",
        );
      }
    }
  }

  async function mintValidatedCard(transactionDatabase, mint) {
    const counter = await cardMintCounterRepository.allocateNextSerial(
      transactionDatabase,
      mint.cardTemplateId,
    );
    let instance = null;
    for (let attempt = 0; attempt < PUBLIC_CARD_ID_ATTEMPTS; attempt += 1) {
      instance = await cardInstanceRepository.create(
        transactionDatabase,
        {
          cardTemplateId: mint.cardTemplateId,
          ownerPlayerId: mint.ownerPlayerId,
          serialNumber: counter.lastSerialNumber,
          cardLevel: mint.cardLevel,
          obtainedMethod: mint.obtainedMethod,
          publicCardId: generatePublicCardId(),
          accountBound: mint.accountBound,
        },
      );
      if (instance) break;
    }
    if (!instance) {
      throw new CardError(
        "PUBLIC_CARD_ID_EXHAUSTED",
        "A unique public Card ID could not be allocated.",
      );
    }
    const ownershipHistory = await cardOwnershipRepository.create(
      transactionDatabase,
      {
        cardInstanceId: instance.cardInstanceId,
        fromPlayerId: null,
        toPlayerId: mint.ownerPlayerId,
        reason: CREATION_REASONS[mint.obtainedMethod],
        referenceType: mint.referenceType,
        referenceId: mint.referenceId,
      },
    );

    return Object.freeze({ instance, counter, ownershipHistory });
  }

  async function generateUniquePublicCardIds(transactionDatabase, quantity) {
    const generated = new Set();
    for (let attempt = 0; attempt < PUBLIC_CARD_ID_ATTEMPTS; attempt += 1) {
      while (generated.size < quantity) {
        generated.add(String(generatePublicCardId()));
      }
      const existing = await cardInstanceRepository.findExistingPublicIds(
        transactionDatabase,
        [...generated],
      );
      for (const publicCardId of existing) generated.delete(publicCardId);
      if (generated.size === quantity) return [...generated];
    }
    throw new CardError(
      "PUBLIC_CARD_ID_EXHAUSTED",
      "Unique public Card IDs could not be allocated for this batch.",
    );
  }

  async function mintValidatedCards(transactionDatabase, mints) {
    const indexesByTemplate = new Map();
    mints.forEach((mint, index) => {
      const indexes = indexesByTemplate.get(mint.cardTemplateId) ?? [];
      indexes.push(index);
      indexesByTemplate.set(mint.cardTemplateId, indexes);
    });

    const serials = new Array(mints.length);
    const counters = new Array(mints.length);
    for (const [cardTemplateId, indexes] of indexesByTemplate) {
      const counter = await cardMintCounterRepository.allocateSerialRange(
        transactionDatabase,
        cardTemplateId,
        indexes.length,
      );
      const firstSerial = BigInt(counter.lastSerialNumber) -
        BigInt(indexes.length) + 1n;
      indexes.forEach((mintIndex, offset) => {
        serials[mintIndex] = String(firstSerial + BigInt(offset));
        counters[mintIndex] = Object.freeze({
          ...counter,
          lastSerialNumber: serials[mintIndex],
        });
      });
    }

    const publicCardIds = await generateUniquePublicCardIds(
      transactionDatabase,
      mints.length,
    );
    const instances = await cardInstanceRepository.createMany(
      transactionDatabase,
      mints.map((mint, index) => ({
        ...mint,
        serialNumber: serials[index],
        publicCardId: publicCardIds[index],
      })),
    );
    const instancesByPublicId = new Map(
      instances.map((instance) => [instance.publicCardId, instance]),
    );
    const orderedInstances = publicCardIds.map((publicCardId) =>
      instancesByPublicId.get(publicCardId)
    );
    if (orderedInstances.some((instance) => !instance)) {
      throw new CardError(
        "CARD_BATCH_MINT_FAILED",
        "The Card batch could not be created completely.",
      );
    }
    const histories = await cardOwnershipRepository.createMany(
      transactionDatabase,
      orderedInstances.map((instance, index) => ({
        cardInstanceId: instance.cardInstanceId,
        fromPlayerId: null,
        toPlayerId: mints[index].ownerPlayerId,
        reason: CREATION_REASONS[mints[index].obtainedMethod],
        referenceType: mints[index].referenceType,
        referenceId: mints[index].referenceId,
      })),
    );
    const historiesByInstanceId = new Map(
      histories.map((history) => [history.cardInstanceId, history]),
    );
    return Object.freeze(orderedInstances.map((instance, index) =>
      Object.freeze({
        instance,
        counter: counters[index],
        ownershipHistory: historiesByInstanceId.get(instance.cardInstanceId),
      })
    ));
  }

  return Object.freeze({
    async lockOwnedCard(
      { ownerPlayerId, cardInstanceId },
      { database } = {},
    ) {
      const normalizedOwnerPlayerId = normalizeId(ownerPlayerId, "ownerPlayerId");
      const normalizedCardInstanceId = normalizeId(cardInstanceId, "cardInstanceId");
      return useTransaction(databasePool, database, async (transactionDatabase) => {
        const instance = await cardInstanceRepository.findByIdForUpdate(
          transactionDatabase,
          normalizedCardInstanceId,
        );
        if (!instance || instance.ownerPlayerId !== normalizedOwnerPlayerId) {
          throw new CardError("CARD_NOT_OWNED", "You do not own this card.");
        }
        if (instance.status !== "ACTIVE") {
          throw new CardError("CARD_NOT_ACTIVE", "Only active cards can be locked.");
        }
        if (instance.userLock) return instance;
        return cardInstanceRepository.setUserLock(transactionDatabase, {
          cardInstanceId: normalizedCardInstanceId,
          userLock: true,
        });
      });
    },

    async unlockOwnedCard(
      { ownerPlayerId, cardInstanceId },
      { database } = {},
    ) {
      const normalizedOwnerPlayerId = normalizeId(ownerPlayerId, "ownerPlayerId");
      const normalizedCardInstanceId = normalizeId(cardInstanceId, "cardInstanceId");
      return useTransaction(databasePool, database, async (transactionDatabase) => {
        const instance = await cardInstanceRepository.findByIdForUpdate(
          transactionDatabase,
          normalizedCardInstanceId,
        );
        if (!instance || instance.ownerPlayerId !== normalizedOwnerPlayerId) {
          throw new CardError("CARD_NOT_OWNED", "You do not own this card.");
        }
        if (instance.status !== "ACTIVE") {
          throw new CardError("CARD_NOT_ACTIVE", "Only active cards can be unlocked.");
        }
        if (!instance.userLock) return instance;
        return cardInstanceRepository.setUserLock(transactionDatabase, {
          cardInstanceId: normalizedCardInstanceId,
          userLock: false,
        });
      });
    },

    async getInstanceForUpdate(
      cardInstanceId,
      { database = databasePool } = {},
    ) {
      const instance = await cardInstanceRepository.findByIdForUpdate(
        database,
        normalizeId(cardInstanceId, "cardInstanceId"),
      );
      if (!instance) {
        throw new CardError(
          "CARD_INSTANCE_NOT_FOUND",
          "Card Instance was not found.",
        );
      }
      return instance;
    },

    async getInstancesForUpdate(
      cardInstanceIds,
      { database = databasePool } = {},
    ) {
      if (!Array.isArray(cardInstanceIds)) {
        throw new TypeError("cardInstanceIds must be an array.");
      }
      const normalizedIds = cardInstanceIds.map((cardInstanceId) =>
        normalizeId(cardInstanceId, "cardInstanceId"),
      );
      return cardInstanceRepository.findByIdsForUpdate(database, normalizedIds);
    },

    async lockForMarket(
      { cardInstanceId, ownerPlayerId },
      { database } = {},
    ) {
      const normalizedCardInstanceId = normalizeId(
        cardInstanceId,
        "cardInstanceId",
      );
      const normalizedOwnerPlayerId = normalizeId(
        ownerPlayerId,
        "ownerPlayerId",
      );

      return useTransaction(databasePool, database, async (transactionDatabase) => {
        const instance = await cardInstanceRepository.findByIdForUpdate(
          transactionDatabase,
          normalizedCardInstanceId,
        );
        if (!instance || instance.ownerPlayerId !== normalizedOwnerPlayerId) {
          throw new CardError("CARD_NOT_OWNED", "You do not own this card.");
        }
        if (
          instance.status !== "ACTIVE" ||
          instance.marketLock ||
          instance.tradeLock
        ) {
          throw new CardError(
            "CARD_NOT_MARKET_AVAILABLE",
            "This card is not available for a Market listing.",
          );
        }
        if (instance.accountBound) {
          throw new CardError(
            "CARD_ACCOUNT_BOUND",
            "This account-bound card cannot be listed on the Market.",
          );
        }
        if (
          await cardInstanceRepository.isInLineup(
            transactionDatabase,
            normalizedCardInstanceId,
          )
        ) {
          throw new CardError(
            "CARD_IN_LINEUP",
            "Remove this card from the lineup before listing it on the Market.",
          );
        }
        return cardInstanceRepository.setMarketLock(transactionDatabase, {
          cardInstanceId: normalizedCardInstanceId,
          marketLock: true,
        });
      });
    },

    async unlockFromMarket(
      { cardInstanceId, ownerPlayerId },
      { database } = {},
    ) {
      const normalizedCardInstanceId = normalizeId(
        cardInstanceId,
        "cardInstanceId",
      );
      const normalizedOwnerPlayerId = normalizeId(
        ownerPlayerId,
        "ownerPlayerId",
      );

      return useTransaction(databasePool, database, async (transactionDatabase) => {
        const instance = await cardInstanceRepository.findByIdForUpdate(
          transactionDatabase,
          normalizedCardInstanceId,
        );
        if (
          !instance ||
          instance.ownerPlayerId !== normalizedOwnerPlayerId ||
          instance.status !== "ACTIVE" ||
          !instance.marketLock
        ) {
          throw new CardError(
            "CARD_MARKET_LOCK_INVALID",
            "The card Market lock is invalid.",
          );
        }
        return cardInstanceRepository.setMarketLock(transactionDatabase, {
          cardInstanceId: normalizedCardInstanceId,
          marketLock: false,
        });
      });
    },

    async transferMarketOwnership(
      { cardInstanceId, fromPlayerId, toPlayerId, listingId },
      { database } = {},
    ) {
      const normalizedCardInstanceId = normalizeId(
        cardInstanceId,
        "cardInstanceId",
      );
      const normalizedFromPlayerId = normalizeId(fromPlayerId, "fromPlayerId");
      const normalizedToPlayerId = normalizeId(toPlayerId, "toPlayerId");
      const normalizedListingId = normalizeId(listingId, "listingId");

      if (normalizedFromPlayerId === normalizedToPlayerId) {
        throw new CardError(
          "CARD_TRANSFER_SAME_OWNER",
          "Card transfer requires a different owner.",
        );
      }

      return useTransaction(databasePool, database, async (transactionDatabase) => {
        await cardInstanceRepository.removeFromLineups(
          transactionDatabase,
          normalizedCardInstanceId,
        );
        const updated = await cardInstanceRepository.transferMarketOwnership(
          transactionDatabase,
          {
            cardInstanceId: normalizedCardInstanceId,
            fromPlayerId: normalizedFromPlayerId,
            toPlayerId: normalizedToPlayerId,
          },
        );
        if (!updated) {
          throw new CardError(
            "CARD_MARKET_TRANSFER_INVALID",
            "The listed card is no longer available for transfer.",
          );
        }
        const ownershipHistory = await cardOwnershipRepository.create(
          transactionDatabase,
          {
            cardInstanceId: normalizedCardInstanceId,
            fromPlayerId: normalizedFromPlayerId,
            toPlayerId: normalizedToPlayerId,
            reason: "MARKET",
            referenceType: "MARKET_LISTING",
            referenceId: normalizedListingId,
          },
        );
        return Object.freeze({ instance: updated, ownershipHistory });
      });
    },

    async lockForTrade(
      { cardInstanceId, ownerPlayerId },
      { database } = {},
    ) {
      const normalizedCardInstanceId = normalizeId(
        cardInstanceId,
        "cardInstanceId",
      );
      const normalizedOwnerPlayerId = normalizeId(
        ownerPlayerId,
        "ownerPlayerId",
      );

      return useTransaction(databasePool, database, async (transactionDatabase) => {
        const instance = await cardInstanceRepository.findByIdForUpdate(
          transactionDatabase,
          normalizedCardInstanceId,
        );
        if (!instance || instance.ownerPlayerId !== normalizedOwnerPlayerId) {
          throw new CardError("CARD_NOT_OWNED", "You do not own this card.");
        }
        if (
          instance.status !== "ACTIVE" ||
          instance.marketLock ||
          instance.tradeLock
        ) {
          throw new CardError(
            "CARD_NOT_TRADE_AVAILABLE",
            "This card is not available for Direct Trade.",
          );
        }
        if (instance.accountBound) {
          throw new CardError(
            "CARD_ACCOUNT_BOUND",
            "This account-bound card cannot be offered in a Trade.",
          );
        }
        return cardInstanceRepository.setTradeLock(transactionDatabase, {
          cardInstanceId: normalizedCardInstanceId,
          tradeLock: true,
        });
      });
    },

    async unlockFromTrade(
      { cardInstanceId, ownerPlayerId },
      { database } = {},
    ) {
      const normalizedCardInstanceId = normalizeId(
        cardInstanceId,
        "cardInstanceId",
      );
      const normalizedOwnerPlayerId = normalizeId(
        ownerPlayerId,
        "ownerPlayerId",
      );

      return useTransaction(databasePool, database, async (transactionDatabase) => {
        const instance = await cardInstanceRepository.findByIdForUpdate(
          transactionDatabase,
          normalizedCardInstanceId,
        );
        if (
          !instance ||
          instance.ownerPlayerId !== normalizedOwnerPlayerId ||
          instance.status !== "ACTIVE" ||
          !instance.tradeLock
        ) {
          throw new CardError(
            "CARD_TRADE_LOCK_INVALID",
            "The card Direct Trade lock is invalid.",
          );
        }
        return cardInstanceRepository.setTradeLock(transactionDatabase, {
          cardInstanceId: normalizedCardInstanceId,
          tradeLock: false,
        });
      });
    },

    async transferTradeOwnership(
      { cardInstanceId, fromPlayerId, toPlayerId, tradeId },
      { database } = {},
    ) {
      const normalizedCardInstanceId = normalizeId(
        cardInstanceId,
        "cardInstanceId",
      );
      const normalizedFromPlayerId = normalizeId(fromPlayerId, "fromPlayerId");
      const normalizedToPlayerId = normalizeId(toPlayerId, "toPlayerId");
      const normalizedTradeId = normalizeId(tradeId, "tradeId");

      if (normalizedFromPlayerId === normalizedToPlayerId) {
        throw new CardError(
          "CARD_TRANSFER_SAME_OWNER",
          "Card transfer requires a different owner.",
        );
      }

      return useTransaction(databasePool, database, async (transactionDatabase) => {
        await cardInstanceRepository.removeFromLineups(
          transactionDatabase,
          normalizedCardInstanceId,
        );
        const updated = await cardInstanceRepository.transferTradeOwnership(
          transactionDatabase,
          {
            cardInstanceId: normalizedCardInstanceId,
            fromPlayerId: normalizedFromPlayerId,
            toPlayerId: normalizedToPlayerId,
          },
        );
        if (!updated) {
          throw new CardError(
            "CARD_TRADE_TRANSFER_INVALID",
            "The offered card is no longer available for transfer.",
          );
        }
        const ownershipHistory = await cardOwnershipRepository.create(
          transactionDatabase,
          {
            cardInstanceId: normalizedCardInstanceId,
            fromPlayerId: normalizedFromPlayerId,
            toPlayerId: normalizedToPlayerId,
            reason: "DIRECT_TRADE",
            referenceType: "TRADE",
            referenceId: normalizedTradeId,
          },
        );
        return Object.freeze({ instance: updated, ownershipHistory });
      });
    },

    async recordGamesPlayed(
      { ownerPlayerId, cardInstanceIds },
      { database = databasePool } = {},
    ) {
      const normalizedOwnerPlayerId = normalizeId(
        ownerPlayerId,
        "ownerPlayerId",
      );
      if (!Array.isArray(cardInstanceIds) || cardInstanceIds.length === 0) {
        throw new TypeError("cardInstanceIds must be a non-empty array.");
      }
      const normalizedIds = cardInstanceIds.map((cardInstanceId) =>
        normalizeId(cardInstanceId, "cardInstanceId"),
      );
      const updatedIds = await cardInstanceRepository.incrementGamesPlayed(
        database,
        {
          ownerPlayerId: normalizedOwnerPlayerId,
          cardInstanceIds: normalizedIds,
        },
      );
      if (updatedIds.length !== normalizedIds.length) {
        throw new CardError(
          "BATTLE_CARD_INVALID",
          "Every battle card must be active and owned by the Player.",
        );
      }
      return Object.freeze(updatedIds);
    },

    async mintCard(input, { database } = {}) {
      const mint = normalizeMintInput(input);

      return useTransaction(
        databasePool,
        database,
        async (transactionDatabase) => {
          await validateMints(transactionDatabase, [mint]);
          return mintValidatedCard(transactionDatabase, mint);
        },
      );
    },

    async mintCards(inputs, { database } = {}) {
      if (!Array.isArray(inputs) || inputs.length < 1 || inputs.length > 500) {
        throw new TypeError("Card mint batch requires between one and 500 cards.");
      }
      const mints = inputs.map(normalizeMintInput);
      return useTransaction(
        databasePool,
        database,
        async (transactionDatabase) => {
          await validateMints(transactionDatabase, mints);
          return mintValidatedCards(transactionDatabase, mints);
        },
      );
    },

    getInstance,

    async getMintCounter(cardTemplateId, { database = databasePool } = {}) {
      const normalizedCardTemplateId = normalizeId(
        cardTemplateId,
        "cardTemplateId",
      );
      await cardTemplateService.getTemplate(normalizedCardTemplateId, {
        database,
      });
      const counter = await cardMintCounterRepository.findByCardTemplateId(
        database,
        normalizedCardTemplateId,
      );

      return (
        counter ??
        Object.freeze({
          cardTemplateId: normalizedCardTemplateId,
          lastSerialNumber: "0",
          totalMinted: "0",
          currentCirculation: "0",
          updatedAt: null,
        })
      );
    },

    async getOwnershipHistory(
      cardInstanceId,
      { database = databasePool } = {},
    ) {
      const instance = await getInstance(cardInstanceId, { database });

      return cardOwnershipRepository.findByCardInstanceId(
        database,
        instance.cardInstanceId,
      );
    },
  });
}
