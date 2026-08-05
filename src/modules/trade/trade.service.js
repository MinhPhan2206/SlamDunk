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

async function getState(database, trade) {
  const [participants, cards] = await Promise.all([
    tradeRepository.findParticipants(database, trade.tradeId),
    tradeRepository.findCards(database, trade.tradeId),
  ]);
  return Object.freeze({
    trade,
    participants: Object.freeze(participants),
    cards: Object.freeze(cards),
  });
}

export function createTradeService({
  databasePool,
  cardInstanceService,
  economyService,
  playerService,
  tradeConfig,
}) {
  if (
    !Number.isSafeInteger(tradeConfig?.maximumCardsPerPlayer) ||
    !Number.isSafeInteger(tradeConfig?.maximumGoldPerPlayer) ||
    !Number.isSafeInteger(tradeConfig?.expiryMinutes)
  ) throw new TypeError("Valid tradeConfig is required.");
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
        const players = await Promise.all([
          playerService.getPlayerById(initiatorId, { database: transactionDatabase }),
          playerService.getPlayerById(invitedId, { database: transactionDatabase }),
        ]);
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

    async addCard(
      { tradeId, playerId, cardInstanceId },
      { database } = {},
    ) {
      const normalizedTradeId = normalizeId(tradeId, "tradeId");
      const normalizedPlayerId = normalizeId(playerId, "playerId");
      const normalizedCardId = normalizeId(cardInstanceId, "cardInstanceId");

      return useTransaction(databasePool, database, async (transactionDatabase) => {
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

        await tradeRepository.clearConfirmations(transactionDatabase, trade.tradeId);
        return getState(transactionDatabase, trade);
      });
    },

    async removeCard(
      { tradeId, playerId, cardInstanceId },
      { database } = {},
    ) {
      const normalizedTradeId = normalizeId(tradeId, "tradeId");
      const normalizedPlayerId = normalizeId(playerId, "playerId");
      const normalizedCardId = normalizeId(cardInstanceId, "cardInstanceId");

      return useTransaction(databasePool, database, async (transactionDatabase) => {
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
        await tradeRepository.clearConfirmations(transactionDatabase, trade.tradeId);
        return getState(transactionDatabase, trade);
      });
    },

    async setGoldOffer(
      { tradeId, playerId, goldOffered },
      { database } = {},
    ) {
      const normalizedTradeId = normalizeId(tradeId, "tradeId");
      const normalizedPlayerId = normalizeId(playerId, "playerId");
      const normalizedGold = normalizeGold(goldOffered, tradeConfig.maximumGoldPerPlayer);

      return useTransaction(databasePool, database, async (transactionDatabase) => {
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
        await tradeRepository.setGoldOffer(transactionDatabase, {
          tradeId: trade.tradeId,
          playerId: normalizedPlayerId,
          goldOffered: normalizedGold,
        });
        await tradeRepository.clearConfirmations(transactionDatabase, trade.tradeId);
        return getState(transactionDatabase, trade);
      });
    },

    async confirmTrade({ tradeId, playerId }, { database } = {}) {
      const normalizedTradeId = normalizeId(tradeId, "tradeId");
      const normalizedPlayerId = normalizeId(playerId, "playerId");

      return useTransaction(databasePool, database, async (transactionDatabase) => {
        const trade = await tradeRepository.findByIdForUpdate(
          transactionDatabase,
          normalizedTradeId,
        );
        assertOpenTrade(trade);
        let state = await getState(transactionDatabase, trade);
        assertParticipant(state.participants, normalizedPlayerId);
        const hasValue =
          state.cards.length > 0 ||
          state.participants.some(
            (participant) => BigInt(participant.goldOffered) > 0n,
          );
        if (!hasValue) {
          throw new TradeError(
            "TRADE_EMPTY",
            "Add a card or Gold before confirming this Direct Trade.",
          );
        }

        await tradeRepository.confirm(transactionDatabase, {
          tradeId: trade.tradeId,
          playerId: normalizedPlayerId,
        });
        state = await getState(transactionDatabase, trade);
        if (!state.participants.every((participant) => participant.confirmedAt)) {
          return Object.freeze({ ...state, completed: false });
        }

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
              idempotencyKey: `trade:${trade.tradeId}`,
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
        await tradeRepository.resolveAllCards(transactionDatabase, {
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
        await tradeRepository.resolveAllCards(transactionDatabase, {
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
        });
      });
    },

    async setCardOffer({ tradeId, playerId, cardInstanceIds }, { database } = {}) {
      const normalizedTradeId = normalizeId(tradeId, "tradeId");
      const normalizedPlayerId = normalizeId(playerId, "playerId");
      if (!Array.isArray(cardInstanceIds)) throw new TypeError("cardInstanceIds must be an array.");
      const desiredIds = [...new Set(cardInstanceIds.map((id) => normalizeId(id, "cardInstanceId")))];
      if (desiredIds.length > tradeConfig.maximumCardsPerPlayer) {
        throw new TradeError("TRADE_CARD_LIMIT", `Each Player can offer at most ${tradeConfig.maximumCardsPerPlayer} cards.`);
      }
      return useTransaction(databasePool, database, async (transactionDatabase) => {
        const trade = await tradeRepository.findByIdForUpdate(transactionDatabase, normalizedTradeId);
        assertOpenTrade(trade);
        const participants = await tradeRepository.findParticipants(transactionDatabase, trade.tradeId);
        assertParticipant(participants, normalizedPlayerId);
        const state = await getState(transactionDatabase, trade);
        const current = state.cards.filter((card) => card.offeredByPlayerId === normalizedPlayerId);
        const desired = new Set(desiredIds);
        for (const card of current) {
          if (!desired.has(card.cardInstanceId)) {
            await cardInstanceService.unlockFromTrade({ cardInstanceId: card.cardInstanceId, ownerPlayerId: normalizedPlayerId }, { database: transactionDatabase });
            await tradeRepository.resolveCard(transactionDatabase, { tradeCardId: card.tradeCardId, outcome: "REMOVED" });
          }
        }
        const currentIds = new Set(current.map((card) => card.cardInstanceId));
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
        await tradeRepository.clearConfirmations(transactionDatabase, trade.tradeId);
        return getState(transactionDatabase, trade);
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
        await tradeRepository.resolveAllCards(transactionDatabase, { tradeId: trade.tradeId, outcome: "EXPIRED" });
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
