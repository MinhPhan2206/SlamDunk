import { withTransaction } from "../../database/transaction/transaction-manager.js";
import { EconomyCurrency } from "../economy/index.js";
import { rarityDefinitions } from "../../config/rarity-config.js";
import { QuicksellError } from "./quicksell.errors.js";
import { quicksellRepository } from "./quicksell.repository.js";

function normalizeId(value, fieldName) {
  const normalized = String(value);

  if (!/^\d+$/.test(normalized) || BigInt(normalized) <= 0n) {
    throw new TypeError(`${fieldName} must be a positive integer.`);
  }

  return normalized;
}

function validateRewards(rewards) {
  for (const [rarityCode, reward] of Object.entries(rewards ?? {})) {
    if (
      !rarityCode ||
      !Number.isSafeInteger(reward?.gold) || reward.gold <= 0 ||
      !Number.isSafeInteger(reward?.shards) || reward.shards <= 0
    ) {
      throw new TypeError(
        "Each quicksell rarity reward requires positive Gold and Shards.",
      );
    }
  }
}

const POSITIONS = new Set(["PG", "SG", "SF", "PF", "C"]);
const PREVIEW_MINUTES = 5;
const rarityAliases = new Map();
for (const rarity of rarityDefinitions) {
  for (const alias of [rarity.rarityCode, rarity.name, rarity.name.replace(/-/g, "")]) {
    rarityAliases.set(alias.toUpperCase().replace(/[ -]/g, "_"), rarity.rarityCode);
  }
}

function normalizeInteractionId(value) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new TypeError("interactionId must be a numeric string.");
  }
  return value;
}

function parseParams(params, cardInstanceId) {
  const value = String(params).trim();
  if (!value) throw new QuicksellError("PARAMS_REQUIRED", "Quicksell params are required.");
  if (value.toLowerCase() === "all") return Object.freeze({ type: "ALL", value: null, label: "all" });
  if (/^!?\d+$/.test(value)) {
    if (!cardInstanceId) throw new QuicksellError("CARD_NOT_FOUND", "Card was not found.");
    return Object.freeze({ type: "CARD", value: String(cardInstanceId), label: value });
  }
  const normalized = value.toUpperCase().replace(/[ -]/g, "_");
  if (POSITIONS.has(normalized)) return Object.freeze({ type: "POSITION", value: normalized, label: normalized });
  const rarityCode = rarityAliases.get(normalized);
  if (rarityCode) return Object.freeze({ type: "RARITY", value: rarityCode, label: rarityCode });
  throw new QuicksellError(
    "INVALID_PARAMS",
    "Use all, a rarity, a position, or a public Card ID/collection number.",
  );
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60_000);
}

export function createQuicksellService({
  databasePool,
  economyService,
  securityService,
  quicksellConfig,
}) {
  validateRewards(quicksellConfig?.rewards);

  async function hydrateSession(database, session) {
    return Object.freeze({
      session,
      cards: Object.freeze(
        await quicksellRepository.findSessionCards(
          database,
          session.quicksellSessionId,
        ),
      ),
    });
  }

  return Object.freeze({
    async createPreview(
      { playerId, params, interactionId, cardInstanceId = null },
      { database } = {},
    ) {
      const normalizedPlayerId = normalizeId(playerId, "playerId");
      const normalizedInteractionId = normalizeInteractionId(interactionId);
      const parsed = parseParams(params, cardInstanceId);
      const operation = async (transactionDatabase) => {
        await securityService?.assertCanEarn(
          { playerId: normalizedPlayerId },
          { database: transactionDatabase },
        );
        const existing = await quicksellRepository.findSessionByInteraction(
          transactionDatabase,
          normalizedInteractionId,
        );
        if (existing) return hydrateSession(transactionDatabase, existing);

        let cards = await quicksellRepository.findEligibleCards(
          transactionDatabase,
          normalizedPlayerId,
        );
        if (parsed.type === "CARD") {
          cards = cards.filter((card) => card.cardInstanceId === parsed.value);
        } else if (parsed.type === "RARITY") {
          cards = cards.filter((card) => card.rarityCode === parsed.value);
        } else if (parsed.type === "POSITION") {
          cards = cards.filter(
            (card) =>
              card.primaryPosition === parsed.value ||
              card.secondaryPosition === parsed.value,
          );
        }

        cards = cards
          .map((card) => {
            const reward = quicksellConfig.rewards[card.rarityCode];
            if (!reward) {
              throw new QuicksellError(
                "RARITY_REWARD_NOT_CONFIGURED",
                `Quicksell reward is not configured for ${card.rarityCode}.`,
              );
            }
            return Object.freeze({
              ...card,
              goldReward: reward.gold,
              shardReward: reward.shards,
            });
          })
          .sort(
            (left, right) =>
              right.goldReward - left.goldReward ||
              right.shardReward - left.shardReward ||
              Number(left.publicCardId) - Number(right.publicCardId),
          );

        if (cards.length === 0) {
          throw new QuicksellError(
            "NO_ELIGIBLE_CARDS",
            "No unlocked, available cards match those params.",
          );
        }
        const totalGold = cards.reduce((total, card) => total + card.goldReward, 0);
        const totalShards = cards.reduce((total, card) => total + card.shardReward, 0);
        const session = await quicksellRepository.createSession(
          transactionDatabase,
          {
            playerId: normalizedPlayerId,
            requestParams: parsed.label,
            interactionId: normalizedInteractionId,
            totalGold,
            totalShards,
            expiresAt: addMinutes(new Date(), PREVIEW_MINUTES),
          },
        );
        await quicksellRepository.addSessionCards(
          transactionDatabase,
          session.quicksellSessionId,
          cards,
        );
        return Object.freeze({ session, cards: Object.freeze(cards) });
      };
      return database ? operation(database) : withTransaction(databasePool, operation);
    },

    async confirmPreview(
      { playerId, quicksellSessionId },
      { database } = {},
    ) {
      const normalizedPlayerId = normalizeId(playerId, "playerId");
      const normalizedSessionId = normalizeId(quicksellSessionId, "quicksellSessionId");
      const operation = async (transactionDatabase) => {
        await securityService?.assertCanEarn(
          { playerId: normalizedPlayerId },
          { database: transactionDatabase },
        );
        const session = await quicksellRepository.findSessionForUpdate(
          transactionDatabase,
          normalizedSessionId,
        );
        if (!session || session.playerId !== normalizedPlayerId) {
          throw new QuicksellError("SESSION_NOT_FOUND", "Quicksell preview was not found.");
        }
        if (session.status === "COMPLETED") return hydrateSession(transactionDatabase, session);
        if (session.status !== "OPEN") {
          throw new QuicksellError("SESSION_CLOSED", "This Quicksell preview is no longer active.");
        }
        if (session.expiresAt <= new Date()) {
          await quicksellRepository.finishSession(transactionDatabase, {
            quicksellSessionId: normalizedSessionId,
            status: "EXPIRED",
          });
          throw new QuicksellError("SESSION_EXPIRED", "This Quicksell preview has expired.");
        }
        const cards = await quicksellRepository.findSessionCards(
          transactionDatabase,
          normalizedSessionId,
          { forUpdate: true },
        );
        if (
          cards.length === 0 ||
          cards.some(
            (card) =>
              card.ownerPlayerId !== normalizedPlayerId ||
              card.status !== "ACTIVE" ||
              card.userLock ||
              card.marketLock ||
              card.tradeLock ||
              card.accountBound ||
              card.inLineup,
          )
        ) {
          throw new QuicksellError(
            "PREVIEW_CHANGED",
            "One or more cards are no longer available. Run /quicksell again.",
          );
        }

        for (const card of cards) {
          await quicksellRepository.destroyCard(transactionDatabase, card.cardInstanceId);
          const circulation = await quicksellRepository.decrementCirculation(
            transactionDatabase,
            card.cardTemplateId,
          );
          if (circulation == null) {
            throw new QuicksellError("CIRCULATION_INVARIANT", "Card circulation could not be updated.");
          }
          await quicksellRepository.createOwnershipEvent(transactionDatabase, {
            cardInstanceId: card.cardInstanceId,
            playerId: normalizedPlayerId,
          });
        }
        const goldEconomy = await economyService.credit(
          {
            playerId: normalizedPlayerId,
            currency: EconomyCurrency.GOLD,
            amount: Number(session.totalGold),
            transactionType: "QUICKSELL_BATCH",
            referenceType: "QUICKSELL_SESSION",
            referenceId: normalizedSessionId,
            idempotencyKey: `quicksell-session:${normalizedSessionId}:gold`,
          },
          { database: transactionDatabase },
        );
        const shardEconomy = await economyService.credit(
          {
            playerId: normalizedPlayerId,
            currency: EconomyCurrency.SHARDS,
            amount: Number(session.totalShards),
            transactionType: "QUICKSELL_BATCH",
            referenceType: "QUICKSELL_SESSION",
            referenceId: normalizedSessionId,
            idempotencyKey: `quicksell-session:${normalizedSessionId}:shards`,
          },
          { database: transactionDatabase },
        );
        const completed = await quicksellRepository.finishSession(
          transactionDatabase,
          {
            quicksellSessionId: normalizedSessionId,
            status: "COMPLETED",
            goldBalanceAfter: goldEconomy.balanceAfter,
            shardBalanceAfter: shardEconomy.balanceAfter,
          },
        );
        return Object.freeze({ session: completed, cards: Object.freeze(cards) });
      };
      return database ? operation(database) : withTransaction(databasePool, operation);
    },

    async cancelPreview(
      { playerId, quicksellSessionId },
      { database } = {},
    ) {
      const normalizedPlayerId = normalizeId(playerId, "playerId");
      const normalizedSessionId = normalizeId(quicksellSessionId, "quicksellSessionId");
      const operation = async (transactionDatabase) => {
        const session = await quicksellRepository.findSessionForUpdate(
          transactionDatabase,
          normalizedSessionId,
        );
        if (!session || session.playerId !== normalizedPlayerId) {
          throw new QuicksellError("SESSION_NOT_FOUND", "Quicksell preview was not found.");
        }
        if (session.status === "OPEN") {
          const cancelled = await quicksellRepository.finishSession(
            transactionDatabase,
            { quicksellSessionId: normalizedSessionId, status: "CANCELLED" },
          );
          return Object.freeze({ session: cancelled });
        }
        if (session.status === "CANCELLED") return Object.freeze({ session });
        throw new QuicksellError(
          "SESSION_CLOSED",
          "This Quicksell preview is no longer active.",
        );
      };
      return database ? operation(database) : withTransaction(databasePool, operation);
    },

    async quicksell({ playerId, cardInstanceId }, { database } = {}) {
      const normalizedPlayerId = normalizeId(playerId, "playerId");
      const normalizedCardInstanceId = normalizeId(
        cardInstanceId,
        "cardInstanceId",
      );

      const operation = async (transactionDatabase) => {
        await securityService?.assertCanEarn(
          { playerId: normalizedPlayerId },
          { database: transactionDatabase },
        );
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
        if (card.userLock) {
          throw new QuicksellError(
            "CARD_USER_LOCKED",
            "Unlock this protected card before quickselling it.",
          );
        }
        if (card.accountBound) {
          throw new QuicksellError(
            "CARD_ACCOUNT_BOUND",
            "This account-bound card cannot be quicksold.",
          );
        }
        if (card.inLineup) {
          throw new QuicksellError(
            "CARD_IN_LINEUP",
            "Remove this card from your lineup before quickselling it.",
          );
        }

        const reward = quicksellConfig.rewards[card.rarityCode];
        if (!reward) {
          throw new QuicksellError(
            "RARITY_REWARD_NOT_CONFIGURED",
            "This card rarity cannot be quicksold yet.",
          );
        }
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
        const goldEconomy = await economyService.credit(
          {
            playerId: normalizedPlayerId,
            currency: EconomyCurrency.GOLD,
            amount: reward.gold,
            transactionType: "QUICKSELL",
            referenceType: "CARD_INSTANCE",
            referenceId: card.cardInstanceId,
            idempotencyKey: `quicksell:${card.cardInstanceId}:gold`,
          },
          { database: transactionDatabase },
        );
        const shardEconomy = await economyService.credit(
          {
            playerId: normalizedPlayerId,
            currency: EconomyCurrency.SHARDS,
            amount: reward.shards,
            transactionType: "QUICKSELL",
            referenceType: "CARD_INSTANCE",
            referenceId: card.cardInstanceId,
            idempotencyKey: `quicksell:${card.cardInstanceId}:shards`,
          },
          { database: transactionDatabase },
        );

        return Object.freeze({
          card,
          goldReward: reward.gold,
          shardReward: reward.shards,
          goldBalance: goldEconomy.balanceAfter,
          shardBalance: shardEconomy.balanceAfter,
        });
      };

      return database
        ? operation(database)
        : withTransaction(databasePool, operation);
    },
  });
}
