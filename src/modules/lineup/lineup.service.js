import { withTransaction } from "../../database/transaction/transaction-manager.js";
import { getActualCardStats } from "../card/card-stats.js";
import { LineupError } from "./lineup.errors.js";
import { lineupRepository } from "./lineup.repository.js";
import {
  normalizeLineupStrategy,
  prunePlayerTendencies,
} from "./lineup-strategy.js";

const SLOTS = Object.freeze(["PG", "SG", "SF", "PF", "C"]);

function normalizeId(value, fieldName) {
  const normalized = String(value);

  if (!/^\d+$/.test(normalized) || BigInt(normalized) <= 0n) {
    throw new TypeError(`${fieldName} must be a positive integer.`);
  }

  return normalized;
}

function normalizeSlot(slot) {
  if (!SLOTS.includes(slot)) {
    throw new TypeError("slot must be PG, SG, SF, PF, or C.");
  }

  return slot;
}

function normalizeLineupNumber(value) {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < 1 || normalized > 3) {
    throw new TypeError("lineupNumber must be 1, 2, or 3.");
  }
  return normalized;
}

function normalizeStrategyRevision(value, fieldName = "strategyRevision") {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < 1) {
    throw new TypeError(`${fieldName} must be a positive integer.`);
  }

  return normalized;
}

function strategyState(lineup) {
  return Object.freeze({
    lineupId: lineup.lineupId,
    strategy: normalizeLineupStrategy(lineup.strategyConfig),
    strategyRevision: normalizeStrategyRevision(lineup.strategyRevision),
  });
}

async function loadLineup(database, playerId) {
  const lineup = await lineupRepository.getOrCreate(database, playerId);
  const storedSlots = await lineupRepository.findSlots(database, lineup.lineupId);
  const slotsByName = new Map(storedSlots.map((slot) => [
    slot.slot,
    Object.freeze({
      ...slot,
      actualStats: getActualCardStats(slot, slot.cardLevel),
    }),
  ]));
  const slots = SLOTS.map((slot) => slotsByName.get(slot) ?? Object.freeze({ slot, cardInstanceId: null }));
  const currentStrategy = strategyState(lineup);

  return Object.freeze({
    lineup,
    slots: Object.freeze(slots),
    complete: storedSlots.length === SLOTS.length,
    strategy: currentStrategy.strategy,
    strategyRevision: currentStrategy.strategyRevision,
  });
}

export function createLineupService({ databasePool, securityService }) {
  return Object.freeze({
    async getLineup(playerId, { database = databasePool } = {}) {
      return loadLineup(database, normalizeId(playerId, "playerId"));
    },

    async getStrategy(playerId, { database = databasePool } = {}) {
      const lineup = await lineupRepository.getOrCreate(
        database,
        normalizeId(playerId, "playerId"),
      );
      const slots = await lineupRepository.findSlots(database, lineup.lineupId);
      return Object.freeze({
        ...strategyState(lineup),
        players: Object.freeze(slots.map((slot) => Object.freeze({
          slot: slot.slot,
          cardInstanceId: slot.cardInstanceId,
          playerName: slot.playerName,
        }))),
      });
    },

    async saveStrategy(
      { playerId, lineupId, strategy, expectedRevision },
      { database = databasePool } = {},
    ) {
      await securityService?.assertPlayerActive({ playerId }, { database });
      const lineup = await lineupRepository.getOrCreate(
        database,
        normalizeId(playerId, "playerId"),
      );
      if (lineup.lineupId !== normalizeId(lineupId, "lineupId")) {
        throw new LineupError(
          "STRATEGY_LINEUP_CHANGED",
          "Your active lineup changed. Reopen /strategy and try again.",
        );
      }
      const slots = await lineupRepository.findSlots(database, lineup.lineupId);
      const strategyConfig = prunePlayerTendencies(
        normalizeLineupStrategy(strategy),
        slots.map((slot) => slot.cardInstanceId),
      );
      const savedLineup = await lineupRepository.updateStrategy(database, {
        lineupId: lineup.lineupId,
        strategyConfig,
        expectedRevision: normalizeStrategyRevision(
          expectedRevision,
          "expectedRevision",
        ),
      });

      if (!savedLineup) {
        throw new LineupError(
          "STRATEGY_REVISION_CONFLICT",
          "The strategy changed in another editor. Reopen /strategy and try again.",
        );
      }

      return strategyState(savedLineup);
    },

    async swapActiveLineup(
      { playerId, lineupNumber },
      { database } = {},
    ) {
      const normalizedPlayerId = normalizeId(playerId, "playerId");
      const normalizedLineupNumber = normalizeLineupNumber(lineupNumber);
      const operation = async (transactionDatabase) => {
        await securityService?.assertPlayerActive(
          { playerId: normalizedPlayerId },
          { database: transactionDatabase },
        );
        await transactionDatabase.query(
          "SELECT pg_advisory_xact_lock(hashtext($1))",
          [`lineup-player:${normalizedPlayerId}`],
        );
        await lineupRepository.getOrCreate(
          transactionDatabase,
          normalizedPlayerId,
        );
        await lineupRepository.createSavedLineup(transactionDatabase, {
          playerId: normalizedPlayerId,
          lineupNumber: normalizedLineupNumber,
        });
        const active = await lineupRepository.activate(transactionDatabase, {
          playerId: normalizedPlayerId,
          lineupNumber: normalizedLineupNumber,
        });
        if (!active) {
          throw new LineupError(
            "LINEUP_NOT_FOUND",
            "The selected lineup could not be activated.",
          );
        }
        return loadLineup(transactionDatabase, normalizedPlayerId);
      };
      return database
        ? operation(database)
        : withTransaction(databasePool, operation);
    },

    async setCard(
      { playerId, slot, cardInstanceId },
      { database } = {},
    ) {
      const normalizedPlayerId = normalizeId(playerId, "playerId");
      const normalizedSlot = normalizeSlot(slot);
      const normalizedCardInstanceId = normalizeId(
        cardInstanceId,
        "cardInstanceId",
      );

      const operation = async (transactionDatabase) => {
        await securityService?.assertPlayerActive(
          { playerId: normalizedPlayerId },
          { database: transactionDatabase },
        );
        const lineup = await lineupRepository.getOrCreate(
          transactionDatabase,
          normalizedPlayerId,
        );
        const card = await lineupRepository.findCardForUpdate(
          transactionDatabase,
          normalizedCardInstanceId,
        );

        if (!card) {
          throw new LineupError("CARD_NOT_FOUND", "Card Instance was not found.");
        }
        if (card.owner_player_id !== normalizedPlayerId) {
          throw new LineupError("CARD_NOT_OWNED", "You do not own this card.");
        }
        if (card.status !== "ACTIVE") {
          throw new LineupError("CARD_NOT_ACTIVE", "Only active cards can enter a lineup.");
        }
        if (card.market_lock || card.trade_lock) {
          throw new LineupError(
            "CARD_LOCKED",
            "Market-listed or trade-locked cards cannot enter a lineup.",
          );
        }
        if (![card.primary_position, card.secondary_position].includes(normalizedSlot)) {
          throw new LineupError(
            "CARD_POSITION_INELIGIBLE",
            `This card cannot play the ${normalizedSlot} slot.`,
          );
        }

        const existingSlot = await lineupRepository.findSlotByCard(
          transactionDatabase,
          { lineupId: lineup.lineupId, cardInstanceId: normalizedCardInstanceId },
        );
        if (existingSlot && existingSlot !== normalizedSlot) {
          throw new LineupError(
            "CARD_ALREADY_IN_LINEUP",
            `This card is already assigned to ${existingSlot}.`,
          );
        }

        const existingPlayerSlot = await lineupRepository.findSlotByPlayerName(
          transactionDatabase,
          {
            lineupId: lineup.lineupId,
            playerName: card.player_name,
            excludedSlot: normalizedSlot,
          },
        );
        if (existingPlayerSlot) {
          throw new LineupError(
            "PLAYER_ALREADY_IN_LINEUP",
            `${card.player_name} is already assigned to ${existingPlayerSlot}.`,
          );
        }

        await lineupRepository.setSlot(transactionDatabase, {
          lineupId: lineup.lineupId,
          slot: normalizedSlot,
          cardInstanceId: normalizedCardInstanceId,
        });
        return loadLineup(transactionDatabase, normalizedPlayerId);
      };

      return database
        ? operation(database)
        : withTransaction(databasePool, operation);
    },

    async removeCard({ playerId, slot }, { database } = {}) {
      const normalizedPlayerId = normalizeId(playerId, "playerId");
      const normalizedSlot = normalizeSlot(slot);
      const operation = async (transactionDatabase) => {
        await securityService?.assertPlayerActive(
          { playerId: normalizedPlayerId },
          { database: transactionDatabase },
        );
        const lineup = await lineupRepository.getOrCreate(
          transactionDatabase,
          normalizedPlayerId,
        );
        await lineupRepository.removeSlot(transactionDatabase, {
          lineupId: lineup.lineupId,
          slot: normalizedSlot,
        });
        return loadLineup(transactionDatabase, normalizedPlayerId);
      };

      return database
        ? operation(database)
        : withTransaction(databasePool, operation);
    },
  });
}
