import { withTransaction } from "../../database/transaction/transaction-manager.js";
import { CardError } from "../card/index.js";
import { EconomyCurrency, EconomyError } from "../economy/index.js";
import { TradeError } from "./trade.errors.js";
import { tradeRepository } from "./trade.repository.js";

function normalizeId(value, fieldName) {
  const normalized = String(value);
  if (!/^\d+$/.test(normalized) || BigInt(normalized) <= 0n) {
    throw new TypeError(`${fieldName} must be a positive integer.`);
  }
  return normalized;
}

function normalizeGold(value, maximumGold) {
  if (
    typeof value !== "bigint" &&
    !(typeof value === "string" && /^\d+$/.test(value)) &&
    !(typeof value === "number" && Number.isSafeInteger(value))
  ) {
    throw new TypeError("goldOffered must be a non-negative integer.");
  }
  const amount = BigInt(value);
  if (amount < 0n || amount > BigInt(maximumGold)) {
    throw new TradeError("TRADE_GOLD_LIMIT", `Gold offered cannot exceed ${maximumGold}.`);
  }
  return amount.toString();
}

function normalizeRevision(value) {
  const revision = Number(value);
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw new TradeError("TRADE_REVISION_INVALID", "Trade offer version is invalid.");
  }
  return revision;
}

function normalizeItemQuantity(value) {
  const quantity = Number(value);
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new TradeError(
      "TRADE_ITEM_QUANTITY_INVALID",
      "Item quantity must be a positive integer.",
    );
  }
  return quantity;
}

function normalizeOfferOperation(value, { allowSet = false } = {}) {
  const operation = String(value ?? (allowSet ? "SET" : "")).trim().toUpperCase();
  const allowed = allowSet ? ["ADD", "REMOVE", "SET"] : ["ADD", "REMOVE"];
  if (!allowed.includes(operation)) {
    throw new TradeError(
      "TRADE_OPERATION_INVALID",
      `Action must be ${allowSet ? "add, remove, or set" : "add or remove"}.`,
    );
  }
  return operation;
}

function useTransaction(databasePool, database, operation) {
  return database
    ? operation(database)
    : withTransaction(databasePool, operation);
}

function assertOpenTrade(trade) {
  if (!trade) {
    throw new TradeError("TRADE_NOT_FOUND", "Direct Trade was not found.");
  }
  if (trade.status !== "OPEN") {
    throw new TradeError(
      "TRADE_NOT_OPEN",
      "This Direct Trade is no longer open.",
    );
  }
  if (trade.expiresAt <= new Date()) {
    throw new TradeError("TRADE_EXPIRED", "This Direct Trade has expired.");
  }
}

function assertParticipant(participants, playerId) {
  if (!participants.some((participant) => participant.playerId === playerId)) {
    throw new TradeError(
      "TRADE_NOT_PARTICIPANT",
      "You are not a participant in this Direct Trade.",
    );
  }
}

function assertAcceptedTrade(participants) {
  if (!participants.every((participant) => participant.acceptedAt)) {
    throw new TradeError(
      "TRADE_INVITATION_PENDING",
      "Both Players must accept the invitation before editing this Direct Trade.",
    );
  }
}

function assertCurrentRevision(trade, offerRevision) {
  if (trade.offerRevision !== offerRevision) {
    throw new TradeError(
      "TRADE_OFFER_CHANGED",
      "The offer changed. Review the latest Trade before continuing.",
    );
  }
}

function isReadyForRevision(participant, offerRevision) {
  return Boolean(participant.readyAt) && participant.readyRevision === offerRevision;
}

function isFinalForRevision(participant, offerRevision) {
  return Boolean(participant.finalAcceptedAt) &&
    participant.finalAcceptedRevision === offerRevision;
}

function assertCanEditOffer(trade, participants, playerId) {
  if (trade.reviewStartedAt) {
    throw new TradeError(
      "TRADE_IN_FINAL_REVIEW",
      "The offer is in Final Review. Return to Editing before changing it.",
    );
  }
  const participant = participants.find((entry) => entry.playerId === playerId);
  if (participant?.readyAt) {
    throw new TradeError(
      "TRADE_PLAYER_READY",
      "Undo Ready before changing your offer.",
    );
  }
}

async function getState(database, trade) {
  const participants = await tradeRepository.findParticipants(database, trade.tradeId);
  const cards = await tradeRepository.findCards(database, trade.tradeId);
  const items = await tradeRepository.findItems(database, trade.tradeId);
  return Object.freeze({
    trade,
    participants: Object.freeze(participants),
    cards: Object.freeze(cards),
    items: Object.freeze(items),
  });
}

export function createTradeService({
  databasePool,
  cardInstanceService,
  economyService,
  inventoryService,
  playerService,
  securityService,
  tradeConfig,
}) {
  if (
    !Number.isSafeInteger(tradeConfig?.maximumCardsPerPlayer) ||
    !Number.isSafeInteger(tradeConfig?.maximumGoldPerPlayer) ||
    !Number.isSafeInteger(tradeConfig?.expiryMinutes) ||
    !Number.isSafeInteger(tradeConfig?.reviewDelaySeconds) ||
    !Array.isArray(tradeConfig?.tradeableItemTypes) ||
    typeof inventoryService?.consumeItem !== "function" ||
    typeof inventoryService?.grantItem !== "function"
  ) throw new TypeError("Valid tradeConfig is required.");
  const tradeableItemTypes = new Set(
    tradeConfig.tradeableItemTypes.map((itemType) => String(itemType).toUpperCase()),
  );
  const service = {
    async createTrade(
      { initiatorPlayerId, invitedPlayerId },
      { database } = {},
    ) {
      const initiatorId = normalizeId(initiatorPlayerId, "initiatorPlayerId");
      const invitedId = normalizeId(invitedPlayerId, "invitedPlayerId");
      if (initiatorId === invitedId) {
        throw new TradeError(
          "TRADE_SAME_PLAYER",
          "Direct Trade requires two different players.",
        );
      }

      return useTransaction(databasePool, database, async (transactionDatabase) => {
        await securityService?.assertCanTrade(
          { playerIds: [initiatorId, invitedId] },
          { database: transactionDatabase },
        );
        const players = [
          await playerService.getPlayerById(initiatorId, { database: transactionDatabase }),
          await playerService.getPlayerById(invitedId, { database: transactionDatabase }),
        ];
        if (players.some((player) => !player)) {
          throw new TradeError(
            "TRADE_PLAYER_NOT_FOUND",
            "One of the Direct Trade players was not found.",
          );
        }
        const trade = await tradeRepository.create(transactionDatabase, {
          createdByPlayerId: initiatorId,
          participantPlayerIds: [initiatorId, invitedId],
          expiresAt: new Date(Date.now() + tradeConfig.expiryMinutes * 60_000),
        });
        return getState(transactionDatabase, trade);
      });
    },

    async getTrade({ tradeId, playerId }, { database = databasePool } = {}) {
      const normalizedTradeId = normalizeId(tradeId, "tradeId");
      const normalizedPlayerId = normalizeId(playerId, "playerId");
      const trade = await tradeRepository.findById(database, normalizedTradeId);
      if (!trade) {
        throw new TradeError("TRADE_NOT_FOUND", "Direct Trade was not found.");
      }
      const state = await getState(database, trade);
      assertParticipant(state.participants, normalizedPlayerId);
      return state;
    },

    async acceptTrade({ tradeId, playerId }, { database } = {}) {
      const normalizedTradeId = normalizeId(tradeId, "tradeId");
      const normalizedPlayerId = normalizeId(playerId, "playerId");
      return useTransaction(databasePool, database, async (transactionDatabase) => {
        await securityService?.assertCanTrade(
          { playerIds: [normalizedPlayerId] },
          { database: transactionDatabase },
        );
        const trade = await tradeRepository.findByIdForUpdate(
          transactionDatabase,
          normalizedTradeId,
        );
        assertOpenTrade(trade);
        const participants = await tradeRepository.findParticipants(
          transactionDatabase,
          trade.tradeId,
        );
        assertParticipant(participants, normalizedPlayerId);
        await tradeRepository.acceptInvitation(transactionDatabase, {
          tradeId: trade.tradeId,
          playerId: normalizedPlayerId,
        });
        return getState(transactionDatabase, trade);
      });
    },

    async addCard(
      { tradeId, playerId, cardInstanceId, offerRevision },
      { database } = {},
    ) {
      const normalizedTradeId = normalizeId(tradeId, "tradeId");
      const normalizedPlayerId = normalizeId(playerId, "playerId");
      const normalizedCardId = normalizeId(cardInstanceId, "cardInstanceId");
      const normalizedRevision = normalizeRevision(offerRevision);

      return useTransaction(databasePool, database, async (transactionDatabase) => {
        await securityService?.assertCanTrade(
          { playerIds: [normalizedPlayerId] },
          { database: transactionDatabase },
        );
        const trade = await tradeRepository.findByIdForUpdate(
          transactionDatabase,
          normalizedTradeId,
        );
        assertOpenTrade(trade);
        assertCurrentRevision(trade, normalizedRevision);
        const participants = await tradeRepository.findParticipants(
          transactionDatabase,
          trade.tradeId,
        );
        assertParticipant(participants, normalizedPlayerId);
        assertAcceptedTrade(participants);
        assertCanEditOffer(trade, participants, normalizedPlayerId);
        const currentCards = await tradeRepository.findCards(transactionDatabase, trade.tradeId);
        if (currentCards.filter((card) => card.offeredByPlayerId === normalizedPlayerId).length >= tradeConfig.maximumCardsPerPlayer) {
          throw new TradeError("TRADE_CARD_LIMIT", `Each Player can offer at most ${tradeConfig.maximumCardsPerPlayer} cards.`);
        }

        try {
          await cardInstanceService.lockForTrade(
            {
              cardInstanceId: normalizedCardId,
              ownerPlayerId: normalizedPlayerId,
            },
            { database: transactionDatabase },
          );
          await tradeRepository.addCard(transactionDatabase, {
            tradeId: trade.tradeId,
            cardInstanceId: normalizedCardId,
            offeredByPlayerId: normalizedPlayerId,
          });
        } catch (error) {
          if (error instanceof CardError || error?.code === "23505") {
            throw new TradeError(
              "TRADE_CARD_NOT_AVAILABLE",
              error instanceof CardError
                ? error.message
                : "This card is already in an active Direct Trade.",
            );
          }
          throw error;
        }

        const updatedTrade = await tradeRepository.advanceOfferRevision(
          transactionDatabase,
          trade.tradeId,
        );
        return getState(transactionDatabase, updatedTrade);
      });
    },

    async removeCard(
      { tradeId, playerId, cardInstanceId, offerRevision },
      { database } = {},
    ) {
      const normalizedTradeId = normalizeId(tradeId, "tradeId");
      const normalizedPlayerId = normalizeId(playerId, "playerId");
      const normalizedCardId = normalizeId(cardInstanceId, "cardInstanceId");
      const normalizedRevision = normalizeRevision(offerRevision);

      return useTransaction(databasePool, database, async (transactionDatabase) => {
        await securityService?.assertCanTrade(
          { playerIds: [normalizedPlayerId] },
          { database: transactionDatabase },
        );
        const trade = await tradeRepository.findByIdForUpdate(
          transactionDatabase,
          normalizedTradeId,
        );
        assertOpenTrade(trade);
        assertCurrentRevision(trade, normalizedRevision);
        const participants = await tradeRepository.findParticipants(
          transactionDatabase,
          trade.tradeId,
        );
        assertParticipant(participants, normalizedPlayerId);
        assertAcceptedTrade(participants);
        assertCanEditOffer(trade, participants, normalizedPlayerId);
        const tradeCard = await tradeRepository.findActiveCard(
          transactionDatabase,
          { tradeId: trade.tradeId, cardInstanceId: normalizedCardId },
        );
        if (!tradeCard || tradeCard.offered_by_player_id !== normalizedPlayerId) {
          throw new TradeError(
            "TRADE_CARD_NOT_OWNED",
            "This card is not part of your Direct Trade offer.",
          );
        }

        await cardInstanceService.unlockFromTrade(
          { cardInstanceId: normalizedCardId, ownerPlayerId: normalizedPlayerId },
          { database: transactionDatabase },
        );
        await tradeRepository.resolveCard(transactionDatabase, {
          tradeCardId: tradeCard.trade_card_id,
          outcome: "REMOVED",
        });
        const updatedTrade = await tradeRepository.advanceOfferRevision(
          transactionDatabase,
          trade.tradeId,
        );
        return getState(transactionDatabase, updatedTrade);
      });
    },

    async setGoldOffer(
      { tradeId, playerId, goldOffered, operation = "SET", offerRevision },
      { database } = {},
    ) {
      const normalizedTradeId = normalizeId(tradeId, "tradeId");
      const normalizedPlayerId = normalizeId(playerId, "playerId");
      const normalizedOperation = normalizeOfferOperation(operation, { allowSet: true });
      const requestedGold = normalizeGold(goldOffered, tradeConfig.maximumGoldPerPlayer);
      const normalizedRevision = normalizeRevision(offerRevision);

      return useTransaction(databasePool, database, async (transactionDatabase) => {
        await securityService?.assertCanTrade(
          { playerIds: [normalizedPlayerId] },
          { database: transactionDatabase },
        );
        const trade = await tradeRepository.findByIdForUpdate(
          transactionDatabase,
          normalizedTradeId,
        );
        assertOpenTrade(trade);
        assertCurrentRevision(trade, normalizedRevision);
        const participants = await tradeRepository.findParticipants(
          transactionDatabase,
          trade.tradeId,
        );
        assertParticipant(participants, normalizedPlayerId);
        assertAcceptedTrade(participants);
        assertCanEditOffer(trade, participants, normalizedPlayerId);
        const participant = participants.find(
          (entry) => entry.playerId === normalizedPlayerId,
        );
        const currentGold = BigInt(participant.goldOffered);
        const requested = BigInt(requestedGold);
        if (normalizedOperation === "REMOVE" && requested > currentGold) {
          throw new TradeError(
            "TRADE_GOLD_REMOVE_INVALID",
            "You cannot remove more Gold than you currently offer.",
          );
        }
        const normalizedGold = normalizeGold(
          normalizedOperation === "ADD"
            ? currentGold + requested
            : normalizedOperation === "REMOVE"
              ? currentGold - requested
              : requested,
          tradeConfig.maximumGoldPerPlayer,
        );
        await tradeRepository.setGoldOffer(transactionDatabase, {
          tradeId: trade.tradeId,
          playerId: normalizedPlayerId,
          goldOffered: normalizedGold,
        });
        const updatedTrade = await tradeRepository.advanceOfferRevision(
          transactionDatabase,
          trade.tradeId,
        );
        return getState(transactionDatabase, updatedTrade);
      });
    },

    async setItemOffer(
      { tradeId, playerId, itemType, quantity, operation, offerRevision },
      { database } = {},
    ) {
      const normalizedTradeId = normalizeId(tradeId, "tradeId");
      const normalizedPlayerId = normalizeId(playerId, "playerId");
      const normalizedRevision = normalizeRevision(offerRevision);
      const normalizedOperation = normalizeOfferOperation(operation);
      const normalizedItemType = String(itemType ?? "").trim().toUpperCase();
      const normalizedQuantity = normalizeItemQuantity(quantity);
      if (!tradeableItemTypes.has(normalizedItemType)) {
        throw new TradeError(
          "TRADE_ITEM_NOT_ALLOWED",
          "This item cannot be offered in Direct Trade.",
        );
      }

      return useTransaction(databasePool, database, async (transactionDatabase) => {
        await securityService?.assertCanTrade(
          { playerIds: [normalizedPlayerId] },
          { database: transactionDatabase },
        );
        const trade = await tradeRepository.findByIdForUpdate(
          transactionDatabase,
          normalizedTradeId,
        );
        assertOpenTrade(trade);
        assertCurrentRevision(trade, normalizedRevision);
        const state = await getState(transactionDatabase, trade);
        assertParticipant(state.participants, normalizedPlayerId);
        assertAcceptedTrade(state.participants);
        assertCanEditOffer(trade, state.participants, normalizedPlayerId);
        const currentItem = state.items.find((item) =>
          item.offeredByPlayerId === normalizedPlayerId &&
          item.itemType === normalizedItemType
        );
        const currentQuantity = currentItem?.quantity ?? 0;

        if (normalizedOperation === "ADD") {
          const remaining = await inventoryService.consumeItem(
            {
              playerId: normalizedPlayerId,
              itemType: normalizedItemType,
              quantity: normalizedQuantity,
            },
            { database: transactionDatabase },
          );
          if (remaining === null) {
            throw new TradeError(
              "TRADE_ITEM_INSUFFICIENT",
              "You do not have enough of this item.",
            );
          }
          await tradeRepository.setItemQuantity(transactionDatabase, {
            tradeId: trade.tradeId,
            offeredByPlayerId: normalizedPlayerId,
            itemType: normalizedItemType,
            quantity: currentQuantity + normalizedQuantity,
          });
        } else {
          if (!currentItem || normalizedQuantity > currentQuantity) {
            throw new TradeError(
              "TRADE_ITEM_REMOVE_INVALID",
              "You cannot remove more items than you currently offer.",
            );
          }
          await inventoryService.grantItem(
            {
              playerId: normalizedPlayerId,
              itemType: normalizedItemType,
              quantity: normalizedQuantity,
            },
            { database: transactionDatabase },
          );
          const remainingOffered = currentQuantity - normalizedQuantity;
          if (remainingOffered === 0) {
            await tradeRepository.resolveItem(transactionDatabase, {
              tradeItemId: currentItem.tradeItemId,
              outcome: "REMOVED",
            });
          } else {
            await tradeRepository.setItemQuantity(transactionDatabase, {
              tradeId: trade.tradeId,
              offeredByPlayerId: normalizedPlayerId,
              itemType: normalizedItemType,
              quantity: remainingOffered,
            });
          }
        }

        const updatedTrade = await tradeRepository.advanceOfferRevision(
          transactionDatabase,
          trade.tradeId,
        );
        return getState(transactionDatabase, updatedTrade);
      });
    },

    async readyTrade({ tradeId, playerId, offerRevision }, { database } = {}) {
      const normalizedTradeId = normalizeId(tradeId, "tradeId");
      const normalizedPlayerId = normalizeId(playerId, "playerId");
      const normalizedRevision = normalizeRevision(offerRevision);

      return useTransaction(databasePool, database, async (transactionDatabase) => {
        await securityService?.assertCanTrade(
          { playerIds: [normalizedPlayerId] },
          { database: transactionDatabase },
        );
        const trade = await tradeRepository.findByIdForUpdate(
          transactionDatabase,
          normalizedTradeId,
        );
        assertOpenTrade(trade);
        assertCurrentRevision(trade, normalizedRevision);
        let state = await getState(transactionDatabase, trade);
        assertParticipant(state.participants, normalizedPlayerId);
        assertAcceptedTrade(state.participants);
        if (trade.reviewStartedAt) {
          throw new TradeError(
            "TRADE_ALREADY_IN_REVIEW",
            "This Trade is already in Final Review.",
          );
        }
        const hasValue =
          state.cards.length > 0 ||
          state.items.length > 0 ||
          state.participants.some(
            (participant) => BigInt(participant.goldOffered) > 0n,
          );
        if (!hasValue) {
          throw new TradeError(
            "TRADE_EMPTY",
            "Add a Card, Gold, or Item before marking this Direct Trade Ready.",
          );
        }

        await tradeRepository.markReady(transactionDatabase, {
          tradeId: trade.tradeId,
          playerId: normalizedPlayerId,
          offerRevision: normalizedRevision,
        });
        state = await getState(transactionDatabase, trade);
        if (state.participants.every((participant) =>
          isReadyForRevision(participant, normalizedRevision))) {
          const reviewingTrade = await tradeRepository.beginReview(
            transactionDatabase,
            { tradeId: trade.tradeId, offerRevision: normalizedRevision },
          );
          state = await getState(transactionDatabase, reviewingTrade);
        }
        return Object.freeze({ ...state, completed: false });
      });
    },

    async undoReady({ tradeId, playerId, offerRevision }, { database } = {}) {
      const normalizedTradeId = normalizeId(tradeId, "tradeId");
      const normalizedPlayerId = normalizeId(playerId, "playerId");
      const normalizedRevision = normalizeRevision(offerRevision);

      return useTransaction(databasePool, database, async (transactionDatabase) => {
        await securityService?.assertCanTrade(
          { playerIds: [normalizedPlayerId] },
          { database: transactionDatabase },
        );
        const trade = await tradeRepository.findByIdForUpdate(
          transactionDatabase,
          normalizedTradeId,
        );
        assertOpenTrade(trade);
        assertCurrentRevision(trade, normalizedRevision);
        const state = await getState(transactionDatabase, trade);
        assertParticipant(state.participants, normalizedPlayerId);
        assertAcceptedTrade(state.participants);
        const participant = state.participants.find(
          (entry) => entry.playerId === normalizedPlayerId,
        );
        if (!isReadyForRevision(participant, normalizedRevision)) {
          throw new TradeError("TRADE_NOT_READY", "Your offer is not marked Ready.");
        }

        if (trade.reviewStartedAt) {
          const editingTrade = await tradeRepository.clearReview(
            transactionDatabase,
            trade.tradeId,
          );
          return getState(transactionDatabase, editingTrade);
        }
        await tradeRepository.clearPlayerReady(transactionDatabase, {
          tradeId: trade.tradeId,
          playerId: normalizedPlayerId,
        });
        return getState(transactionDatabase, trade);
      });
    },

    async finalAcceptTrade(
      { tradeId, playerId, offerRevision },
      { database } = {},
    ) {
      const normalizedTradeId = normalizeId(tradeId, "tradeId");
      const normalizedPlayerId = normalizeId(playerId, "playerId");
      const normalizedRevision = normalizeRevision(offerRevision);

      return useTransaction(databasePool, database, async (transactionDatabase) => {
        await securityService?.assertCanTrade(
          { playerIds: [normalizedPlayerId] },
          { database: transactionDatabase },
        );
        const trade = await tradeRepository.findByIdForUpdate(
          transactionDatabase,
          normalizedTradeId,
        );
        assertOpenTrade(trade);
        assertCurrentRevision(trade, normalizedRevision);
        let state = await getState(transactionDatabase, trade);
        assertParticipant(state.participants, normalizedPlayerId);
        assertAcceptedTrade(state.participants);
        if (
          !trade.reviewStartedAt ||
          !state.participants.every((participant) =>
            isReadyForRevision(participant, normalizedRevision))
        ) {
          throw new TradeError(
            "TRADE_NOT_IN_FINAL_REVIEW",
            "Both Players must be Ready before Final Accept.",
          );
        }
        const reviewAvailableAt = new Date(trade.reviewStartedAt).getTime() +
          tradeConfig.reviewDelaySeconds * 1_000;
        if (Date.now() < reviewAvailableAt) {
          const seconds = Math.max(1, Math.ceil((reviewAvailableAt - Date.now()) / 1_000));
          throw new TradeError(
            "TRADE_REVIEW_DELAY",
            `Review the final offer for ${seconds} more second${seconds === 1 ? "" : "s"}.`,
          );
        }

        await tradeRepository.markFinalAccepted(transactionDatabase, {
          tradeId: trade.tradeId,
          playerId: normalizedPlayerId,
          offerRevision: normalizedRevision,
        });
        state = await getState(transactionDatabase, trade);
        if (!state.participants.every((participant) =>
          isFinalForRevision(participant, normalizedRevision))) {
          return Object.freeze({ ...state, completed: false });
        }
        await securityService?.assertCanTrade(
          { playerIds: state.participants.map(({ playerId }) => playerId) },
          { database: transactionDatabase },
        );

        const cardIds = state.cards.map((card) => card.cardInstanceId);
        const instances = await cardInstanceService.getInstancesForUpdate(cardIds, {
          database: transactionDatabase,
        });
        if (instances.length !== state.cards.length) {
          throw new TradeError(
            "TRADE_CARD_INVALID",
            "One or more offered cards are no longer available.",
          );
        }
        const instancesById = new Map(
          instances.map((instance) => [instance.cardInstanceId, instance]),
        );
        for (const offeredCard of state.cards) {
          const instance = instancesById.get(offeredCard.cardInstanceId);
          if (
            !instance ||
            instance.ownerPlayerId !== offeredCard.offeredByPlayerId ||
            instance.status !== "ACTIVE" ||
            instance.marketLock ||
            !instance.tradeLock
          ) {
            throw new TradeError(
              "TRADE_CARD_INVALID",
              "One or more offered cards are no longer available.",
            );
          }
        }

        let settlement;
        try {
          settlement = await economyService.settleTrade(
            {
              playerAId: state.participants[0].playerId,
              playerBId: state.participants[1].playerId,
              playerAOffer: state.participants[0].goldOffered,
              playerBOffer: state.participants[1].goldOffered,
              currency: EconomyCurrency.GOLD,
              transactionType: "DIRECT_TRADE",
              referenceType: "TRADE",
              referenceId: trade.tradeId,
              idempotencyKey: `trade:${trade.tradeId}:revision:${normalizedRevision}`,
            },
            { database: transactionDatabase },
          );
        } catch (error) {
          if (
            error instanceof EconomyError &&
            error.code === "INSUFFICIENT_GOLD"
          ) {
            throw new TradeError(
              "INSUFFICIENT_GOLD",
              "A participant no longer has enough Gold for this Direct Trade.",
            );
          }
          throw error;
        }

        const otherPlayer = new Map([
          [state.participants[0].playerId, state.participants[1].playerId],
          [state.participants[1].playerId, state.participants[0].playerId],
        ]);
        for (const offeredCard of state.cards) {
          await cardInstanceService.transferTradeOwnership(
            {
              cardInstanceId: offeredCard.cardInstanceId,
              fromPlayerId: offeredCard.offeredByPlayerId,
              toPlayerId: otherPlayer.get(offeredCard.offeredByPlayerId),
              tradeId: trade.tradeId,
            },
            { database: transactionDatabase },
          );
        }
        for (const offeredItem of state.items) {
          await inventoryService.grantItem(
            {
              playerId: otherPlayer.get(offeredItem.offeredByPlayerId),
              itemType: offeredItem.itemType,
              quantity: offeredItem.quantity,
            },
            { database: transactionDatabase },
          );
        }
        await tradeRepository.resolveAllCards(transactionDatabase, {
          tradeId: trade.tradeId,
          outcome: "TRANSFERRED",
        });
        await tradeRepository.resolveAllItems(transactionDatabase, {
          tradeId: trade.tradeId,
          outcome: "TRANSFERRED",
        });
        const completedTrade = await tradeRepository.markCompleted(
          transactionDatabase,
          trade.tradeId,
        );
        if (!completedTrade) {
          throw new TradeError(
            "TRADE_STATE_CHANGED",
            "Direct Trade state changed before completion.",
          );
        }
        return Object.freeze({
          trade: completedTrade,
          participants: state.participants,
          cards: state.cards,
          items: state.items,
          settlement,
          completed: true,
        });
      });
    },

    async cancelTrade({ tradeId, playerId }, { database } = {}) {
      const normalizedTradeId = normalizeId(tradeId, "tradeId");
      const normalizedPlayerId = normalizeId(playerId, "playerId");

      return useTransaction(databasePool, database, async (transactionDatabase) => {
        const trade = await tradeRepository.findByIdForUpdate(
          transactionDatabase,
          normalizedTradeId,
        );
        assertOpenTrade(trade);
        const state = await getState(transactionDatabase, trade);
        assertParticipant(state.participants, normalizedPlayerId);
        await cardInstanceService.getInstancesForUpdate(
          state.cards.map((card) => card.cardInstanceId),
          { database: transactionDatabase },
        );
        for (const card of state.cards) {
          await cardInstanceService.unlockFromTrade(
            {
              cardInstanceId: card.cardInstanceId,
              ownerPlayerId: card.offeredByPlayerId,
            },
            { database: transactionDatabase },
          );
        }
        for (const item of state.items) {
          await inventoryService.grantItem(
            {
              playerId: item.offeredByPlayerId,
              itemType: item.itemType,
              quantity: item.quantity,
            },
            { database: transactionDatabase },
          );
        }
        await tradeRepository.resolveAllCards(transactionDatabase, {
          tradeId: trade.tradeId,
          outcome: "CANCELLED",
        });
        await tradeRepository.resolveAllItems(transactionDatabase, {
          tradeId: trade.tradeId,
          outcome: "CANCELLED",
        });
        const cancelledTrade = await tradeRepository.markCancelled(
          transactionDatabase,
          trade.tradeId,
        );
        return Object.freeze({
          trade: cancelledTrade,
          participants: state.participants,
          cards: state.cards,
          items: state.items,
        });
      });
    },

    async setCardOffer(
      { tradeId, playerId, cardInstanceIds, operation = "SET", offerRevision },
      { database } = {},
    ) {
      const normalizedTradeId = normalizeId(tradeId, "tradeId");
      const normalizedPlayerId = normalizeId(playerId, "playerId");
      const normalizedRevision = normalizeRevision(offerRevision);
      if (!Array.isArray(cardInstanceIds)) throw new TypeError("cardInstanceIds must be an array.");
      const requestedIds = [...new Set(cardInstanceIds.map((id) =>
        normalizeId(id, "cardInstanceId")))];
      const normalizedOperation = normalizeOfferOperation(operation, { allowSet: true });
      if (requestedIds.length > tradeConfig.maximumCardsPerPlayer) {
        throw new TradeError("TRADE_CARD_LIMIT", `Each Player can offer at most ${tradeConfig.maximumCardsPerPlayer} cards.`);
      }
      return useTransaction(databasePool, database, async (transactionDatabase) => {
        await securityService?.assertCanTrade(
          { playerIds: [normalizedPlayerId] },
          { database: transactionDatabase },
        );
        const trade = await tradeRepository.findByIdForUpdate(transactionDatabase, normalizedTradeId);
        assertOpenTrade(trade);
        assertCurrentRevision(trade, normalizedRevision);
        const participants = await tradeRepository.findParticipants(transactionDatabase, trade.tradeId);
        assertParticipant(participants, normalizedPlayerId);
        assertAcceptedTrade(participants);
        assertCanEditOffer(trade, participants, normalizedPlayerId);
        const state = await getState(transactionDatabase, trade);
        const current = state.cards.filter((card) => card.offeredByPlayerId === normalizedPlayerId);
        const currentIds = new Set(current.map((card) => card.cardInstanceId));
        if (
          normalizedOperation === "REMOVE" &&
          requestedIds.some((cardInstanceId) => !currentIds.has(cardInstanceId))
        ) {
          throw new TradeError(
            "TRADE_CARD_NOT_OFFERED",
            "One or more Cards are not in your current offer.",
          );
        }
        const desiredIds = normalizedOperation === "ADD"
          ? [...new Set([...currentIds, ...requestedIds])]
          : normalizedOperation === "REMOVE"
            ? [...currentIds].filter((cardInstanceId) =>
                !requestedIds.includes(cardInstanceId))
            : requestedIds;
        if (desiredIds.length > tradeConfig.maximumCardsPerPlayer) {
          throw new TradeError("TRADE_CARD_LIMIT", `Each Player can offer at most ${tradeConfig.maximumCardsPerPlayer} cards.`);
        }
        const desired = new Set(desiredIds);
        for (const card of current) {
          if (!desired.has(card.cardInstanceId)) {
            await cardInstanceService.unlockFromTrade({ cardInstanceId: card.cardInstanceId, ownerPlayerId: normalizedPlayerId }, { database: transactionDatabase });
            await tradeRepository.resolveCard(transactionDatabase, { tradeCardId: card.tradeCardId, outcome: "REMOVED" });
          }
        }
        for (const cardInstanceId of desiredIds) {
          if (!currentIds.has(cardInstanceId)) {
            try {
              await cardInstanceService.lockForTrade({ cardInstanceId, ownerPlayerId: normalizedPlayerId }, { database: transactionDatabase });
              await tradeRepository.addCard(transactionDatabase, { tradeId: trade.tradeId, cardInstanceId, offeredByPlayerId: normalizedPlayerId });
            } catch (error) {
              if (error instanceof CardError || error?.code === "23505") {
                throw new TradeError("TRADE_CARD_NOT_AVAILABLE", "One or more cards are unavailable for Direct Trade.");
              }
              throw error;
            }
          }
        }
        const updatedTrade = await tradeRepository.advanceOfferRevision(
          transactionDatabase,
          trade.tradeId,
        );
        return getState(transactionDatabase, updatedTrade);
      });
    },

    async expireTrade({ tradeId }, { database } = {}) {
      const normalizedTradeId = normalizeId(tradeId, "tradeId");
      return useTransaction(databasePool, database, async (transactionDatabase) => {
        const trade = await tradeRepository.findByIdForUpdate(transactionDatabase, normalizedTradeId);
        if (!trade || trade.status !== "OPEN") return trade ? getState(transactionDatabase, trade) : null;
        const state = await getState(transactionDatabase, trade);
        for (const card of state.cards) {
          await cardInstanceService.unlockFromTrade({ cardInstanceId: card.cardInstanceId, ownerPlayerId: card.offeredByPlayerId }, { database: transactionDatabase });
        }
        for (const item of state.items) {
          await inventoryService.grantItem(
            {
              playerId: item.offeredByPlayerId,
              itemType: item.itemType,
              quantity: item.quantity,
            },
            { database: transactionDatabase },
          );
        }
        await tradeRepository.resolveAllCards(transactionDatabase, { tradeId: trade.tradeId, outcome: "EXPIRED" });
        await tradeRepository.resolveAllItems(transactionDatabase, { tradeId: trade.tradeId, outcome: "EXPIRED" });
        const expired = await tradeRepository.markExpired(transactionDatabase, trade.tradeId);
        return Object.freeze({ ...state, trade: expired });
      });
    },

    async expireDueTrades() {
      const trades = await tradeRepository.findExpiredOpen(databasePool);
      const results = [];
      for (const trade of trades) results.push(await service.expireTrade({ tradeId: trade.tradeId }));
      return Object.freeze(results);
    },
  };
  return Object.freeze(service);
}
