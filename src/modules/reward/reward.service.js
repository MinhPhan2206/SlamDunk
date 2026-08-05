import { randomInt } from "node:crypto";

import { withTransaction } from "../../database/transaction/transaction-manager.js";
import { EconomyCurrency, EconomyError } from "../economy/index.js";
import { cooldownRepository } from "./cooldown.repository.js";
import { RewardError } from "./reward.errors.js";

const CLAIM_COOLDOWN_TYPE = "CLAIM";
const CLAIM_TRANSACTION_TYPE = "CLAIM";
const DAILY_COOLDOWN_TYPE = "DAILY";
const DAILY_TRANSACTION_TYPE = "DAILY";
const DISCORD_INTERACTION_REFERENCE = "DISCORD_INTERACTION";

function normalizePositiveInteger(value, fieldName) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${fieldName} must be a positive safe integer.`);
  }

  return value;
}

function normalizePlayerId(playerId) {
  const value = String(playerId);

  if (!/^\d+$/.test(value) || BigInt(value) <= 0n) {
    throw new TypeError("playerId must be a positive integer.");
  }

  return value;
}

function normalizeInteractionId(interactionId) {
  if (typeof interactionId !== "string" || !/^\d+$/.test(interactionId)) {
    throw new TypeError("interactionId must be a numeric string.");
  }

  return interactionId;
}

function validateClaimConfig(claimConfig) {
  const cooldownMinutes = normalizePositiveInteger(
    claimConfig?.cooldownMinutes,
    "claimConfig.cooldownMinutes",
  );
  const minimumGold = normalizePositiveInteger(
    claimConfig?.minimumGold,
    "claimConfig.minimumGold",
  );
  const maximumGold = normalizePositiveInteger(
    claimConfig?.maximumGold,
    "claimConfig.maximumGold",
  );

  if (minimumGold > maximumGold) {
    throw new TypeError(
      "claimConfig.minimumGold must not exceed claimConfig.maximumGold.",
    );
  }

  return Object.freeze({ cooldownMinutes, minimumGold, maximumGold });
}

function validateDailyConfig(dailyConfig) {
  const fields = ["cooldownHours", "minimumGold", "maximumGold", "minimumShards", "maximumShards"];
  const result = {};
  for (const field of fields) {
    result[field] = normalizePositiveInteger(dailyConfig?.[field], `dailyConfig.${field}`);
  }
  if (result.minimumGold > result.maximumGold || result.minimumShards > result.maximumShards) {
    throw new TypeError("Daily reward minimums must not exceed maximums.");
  }
  return Object.freeze(result);
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60_000);
}

function addHours(date, hours) {
  return new Date(date.getTime() + hours * 3_600_000);
}

function createIdempotencyKey(interactionId) {
  return `claim:${interactionId}`;
}

function assertExistingClaim(transaction, { playerId, interactionId }) {
  const validAmount = BigInt(transaction.amount) > 0n;
  const matches =
    transaction.playerId === playerId &&
    transaction.currency === EconomyCurrency.GOLD &&
    transaction.transactionType === CLAIM_TRANSACTION_TYPE &&
    transaction.referenceType === DISCORD_INTERACTION_REFERENCE &&
    transaction.referenceId === interactionId &&
    validAmount;

  if (!matches) {
    throw new EconomyError(
      "IDEMPOTENCY_CONFLICT",
      "The interaction was already used for a different economy movement.",
    );
  }
}

function createClaimResult({ transaction, availableAt, replayed }) {
  return Object.freeze({
    rewardGold: transaction.amount,
    balanceAfter: transaction.balanceAfter,
    availableAt,
    replayed,
  });
}

async function useTransaction(databasePool, database, operation) {
  if (database) {
    return operation(database);
  }

  return withTransaction(databasePool, operation);
}

export function createRewardService({
  databasePool,
  economyService,
  claimConfig,
  dailyConfig,
  rollInteger = randomInt,
}) {
  const config = validateClaimConfig(claimConfig);
  const daily = validateDailyConfig(dailyConfig);

  async function getCooldown(playerId, cooldownType, database) {
    const normalizedPlayerId = normalizePlayerId(playerId);
    const currentTime = await cooldownRepository.getDatabaseTime(database);
    const cooldown = await cooldownRepository.find(database, {
      playerId: normalizedPlayerId,
      cooldownType,
    });
    return Object.freeze({
      cooldownType,
      available: !cooldown || cooldown.availableAt <= currentTime,
      availableAt: cooldown?.availableAt ?? null,
      checkedAt: currentTime,
    });
  }

  return Object.freeze({
    async getClaimCooldown(
      playerId,
      { database = databasePool } = {},
    ) {
      return getCooldown(playerId, CLAIM_COOLDOWN_TYPE, database);
    },

    async getDailyCooldown(playerId, { database = databasePool } = {}) {
      return getCooldown(playerId, DAILY_COOLDOWN_TYPE, database);
    },

    async claimReward({ playerId, interactionId }, { database } = {}) {
      const normalizedPlayerId = normalizePlayerId(playerId);
      const normalizedInteractionId = normalizeInteractionId(interactionId);
      const idempotencyKey = createIdempotencyKey(normalizedInteractionId);

      return useTransaction(
        databasePool,
        database,
        async (transactionDatabase) => {
          const currentTime =
            await cooldownRepository.getDatabaseTime(transactionDatabase);
          const cooldown = await cooldownRepository.getOrCreateForUpdate(
            transactionDatabase,
            {
              playerId: normalizedPlayerId,
              cooldownType: CLAIM_COOLDOWN_TYPE,
            },
          );
          const existingTransaction =
            await economyService.getTransactionByIdempotencyKey(
              idempotencyKey,
              { database: transactionDatabase },
            );

          if (existingTransaction) {
            assertExistingClaim(existingTransaction, {
              playerId: normalizedPlayerId,
              interactionId: normalizedInteractionId,
            });

            return createClaimResult({
              transaction: existingTransaction,
              availableAt: cooldown.availableAt,
              replayed: true,
            });
          }

          if (cooldown.availableAt > currentTime) {
            throw new RewardError(
              "CLAIM_COOLDOWN_ACTIVE",
              "The claim cooldown is still active.",
              { availableAt: cooldown.availableAt },
            );
          }

          const rewardGold = rollInteger(
            config.minimumGold,
            config.maximumGold + 1,
          );

          if (
            !Number.isSafeInteger(rewardGold) ||
            rewardGold < config.minimumGold ||
            rewardGold > config.maximumGold
          ) {
            throw new Error("Claim reward generator returned an invalid value.");
          }

          const economyResult = await economyService.credit(
            {
              playerId: normalizedPlayerId,
              currency: EconomyCurrency.GOLD,
              amount: rewardGold,
              transactionType: CLAIM_TRANSACTION_TYPE,
              referenceType: DISCORD_INTERACTION_REFERENCE,
              referenceId: normalizedInteractionId,
              idempotencyKey,
            },
            { database: transactionDatabase },
          );
          const availableAt = addMinutes(currentTime, config.cooldownMinutes);
          const updatedCooldown = await cooldownRepository.setAvailableAt(
            transactionDatabase,
            {
              playerId: normalizedPlayerId,
              cooldownType: CLAIM_COOLDOWN_TYPE,
              availableAt,
            },
          );

          return createClaimResult({
            transaction: economyResult.transaction,
            availableAt: updatedCooldown.availableAt,
            replayed: false,
          });
        },
      );
    },

    async dailyReward({ playerId, interactionId }, { database } = {}) {
      const normalizedPlayerId = normalizePlayerId(playerId);
      const normalizedInteractionId = normalizeInteractionId(interactionId);
      return useTransaction(databasePool, database, async (transactionDatabase) => {
        const currentTime = await cooldownRepository.getDatabaseTime(transactionDatabase);
        const cooldown = await cooldownRepository.getOrCreateForUpdate(transactionDatabase, {
          playerId: normalizedPlayerId,
          cooldownType: DAILY_COOLDOWN_TYPE,
        });
        const goldKey = `daily:${normalizedInteractionId}:gold`;
        const shardsKey = `daily:${normalizedInteractionId}:shards`;
        const existingGold = await economyService.getTransactionByIdempotencyKey(goldKey, { database: transactionDatabase });
        const existingShards = await economyService.getTransactionByIdempotencyKey(shardsKey, { database: transactionDatabase });
        if (existingGold || existingShards) {
          if (!existingGold || !existingShards) throw new EconomyError("IDEMPOTENCY_CONFLICT", "Daily reward ledger is incomplete.");
          return Object.freeze({
            rewardGold: existingGold.amount,
            rewardShards: existingShards.amount,
            goldBalanceAfter: existingGold.balanceAfter,
            shardBalanceAfter: existingShards.balanceAfter,
            availableAt: cooldown.availableAt,
            replayed: true,
          });
        }
        if (cooldown.availableAt > currentTime) {
          throw new RewardError("DAILY_COOLDOWN_ACTIVE", "The daily cooldown is still active.", { availableAt: cooldown.availableAt });
        }
        const rewardGold = rollInteger(daily.minimumGold, daily.maximumGold + 1);
        const rewardShards = rollInteger(daily.minimumShards, daily.maximumShards + 1);
        const reference = {
          playerId: normalizedPlayerId,
          transactionType: DAILY_TRANSACTION_TYPE,
          referenceType: DISCORD_INTERACTION_REFERENCE,
          referenceId: normalizedInteractionId,
        };
        const gold = await economyService.credit({
          ...reference, currency: EconomyCurrency.GOLD, amount: rewardGold, idempotencyKey: goldKey,
        }, { database: transactionDatabase });
        const shards = await economyService.credit({
          ...reference, currency: EconomyCurrency.SHARDS, amount: rewardShards, idempotencyKey: shardsKey,
        }, { database: transactionDatabase });
        const updated = await cooldownRepository.setAvailableAt(transactionDatabase, {
          playerId: normalizedPlayerId,
          cooldownType: DAILY_COOLDOWN_TYPE,
          availableAt: addHours(currentTime, daily.cooldownHours),
        });
        return Object.freeze({
          rewardGold: String(rewardGold), rewardShards: String(rewardShards),
          goldBalanceAfter: gold.balanceAfter, shardBalanceAfter: shards.balanceAfter,
          availableAt: updated.availableAt, replayed: false,
        });
      });
    },
  });
}
