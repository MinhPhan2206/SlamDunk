import { randomInt } from "node:crypto";

import { withTransaction } from "../../database/transaction/transaction-manager.js";
import { EconomyCurrency, EconomyError } from "../economy/index.js";
import {
  consumeChargeCooldown,
  resolveChargeCooldown,
} from "./charge-cooldown.js";
import { cooldownRepository } from "./cooldown.repository.js";
import { RewardError } from "./reward.errors.js";

const CLAIM_COOLDOWN_TYPE = "CLAIM";
const CLAIM_TRANSACTION_TYPE = "CLAIM";
const DAILY_COOLDOWN_TYPE = "DAILY";
const DAILY_TRANSACTION_TYPE = "DAILY";
const WEEKLY_COOLDOWN_TYPE = "WEEKLY";
const WEEKLY_TRANSACTION_TYPE = "WEEKLY";
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
  const maximumCharges = normalizePositiveInteger(
    claimConfig?.maximumCharges,
    "claimConfig.maximumCharges",
  );

  if (minimumGold > maximumGold) {
    throw new TypeError(
      "claimConfig.minimumGold must not exceed claimConfig.maximumGold.",
    );
  }

  return Object.freeze({
    cooldownMinutes,
    maximumCharges,
    minimumGold,
    maximumGold,
  });
}

function validateDailyConfig(dailyConfig) {
  const fields = ["cooldownHours", "xpReward", "minimumGold", "maximumGold", "minimumShards", "maximumShards"];
  const result = {};
  for (const field of fields) {
    result[field] = normalizePositiveInteger(dailyConfig?.[field], `dailyConfig.${field}`);
  }
  if (result.minimumGold > result.maximumGold || result.minimumShards > result.maximumShards) {
    throw new TypeError("Daily reward minimums must not exceed maximums.");
  }
  return Object.freeze(result);
}

function validateWeeklyConfig(weeklyConfig) {
  const fields = [
    "cooldownHours",
    "xpReward",
    "minimumGold",
    "maximumGold",
    "minimumShards",
    "maximumShards",
  ];
  const result = {};
  for (const field of fields) {
    result[field] = normalizePositiveInteger(
      weeklyConfig?.[field],
      `weeklyConfig.${field}`,
    );
  }
  if (
    result.minimumGold > result.maximumGold ||
    result.minimumShards > result.maximumShards
  ) {
    throw new TypeError("Weekly reward minimums must not exceed maximums.");
  }
  return Object.freeze(result);
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

function createClaimResult({ transaction, chargeState, replayed }) {
  return Object.freeze({
    rewardGold: transaction.amount,
    balanceAfter: transaction.balanceAfter,
    charges: chargeState.charges,
    maximumCharges: chargeState.maximumCharges,
    availableAt: chargeState.nextChargeAt,
    nextChargeAt: chargeState.nextChargeAt,
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
  playerService,
  claimConfig,
  dailyConfig,
  weeklyConfig,
  rollInteger = randomInt,
}) {
  if (!playerService?.awardXp) {
    throw new TypeError("Reward service requires a Player XP service.");
  }
  const config = validateClaimConfig(claimConfig);
  const daily = validateDailyConfig(dailyConfig);
  const weekly = validateWeeklyConfig(weeklyConfig);

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
      const normalizedPlayerId = normalizePlayerId(playerId);
      const currentTime = await cooldownRepository.getDatabaseTime(database);
      const cooldown = await cooldownRepository.find(database, {
        playerId: normalizedPlayerId,
        cooldownType: CLAIM_COOLDOWN_TYPE,
      });
      return Object.freeze({
        cooldownType: CLAIM_COOLDOWN_TYPE,
        ...resolveChargeCooldown({
          cooldown,
          currentTime,
          maximumCharges: config.maximumCharges,
          rechargeMinutes: config.cooldownMinutes,
        }),
      });
    },

    async getDailyCooldown(playerId, { database = databasePool } = {}) {
      return getCooldown(playerId, DAILY_COOLDOWN_TYPE, database);
    },

    async getWeeklyCooldown(playerId, { database = databasePool } = {}) {
      return getCooldown(playerId, WEEKLY_COOLDOWN_TYPE, database);
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
          const chargeState = resolveChargeCooldown({
            cooldown,
            currentTime,
            maximumCharges: config.maximumCharges,
            rechargeMinutes: config.cooldownMinutes,
          });

          if (existingTransaction) {
            assertExistingClaim(existingTransaction, {
              playerId: normalizedPlayerId,
              interactionId: normalizedInteractionId,
            });

            return createClaimResult({
              transaction: existingTransaction,
              chargeState,
              replayed: true,
            });
          }

          if (!chargeState.available) {
            throw new RewardError(
              "CLAIM_COOLDOWN_ACTIVE",
              "The claim cooldown is still active.",
              { availableAt: chargeState.nextChargeAt },
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
          const consumed = consumeChargeCooldown({
            state: chargeState,
            currentTime,
            rechargeMinutes: config.cooldownMinutes,
          });
          await cooldownRepository.setChargeState(
            transactionDatabase,
            {
              playerId: normalizedPlayerId,
              cooldownType: CLAIM_COOLDOWN_TYPE,
              chargesRemaining: consumed.chargesRemaining,
              nextChargeAt: consumed.nextChargeAt,
            },
          );
          const updatedChargeState = Object.freeze({
            ...chargeState,
            charges: consumed.chargesRemaining,
            available: consumed.chargesRemaining > 0,
            availableAt: consumed.nextChargeAt,
            nextChargeAt: consumed.nextChargeAt,
          });

          return createClaimResult({
            transaction: economyResult.transaction,
            chargeState: updatedChargeState,
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
          const xp = await playerService.awardXp({
            playerId: normalizedPlayerId,
            amount: daily.xpReward,
            sourceType: DAILY_TRANSACTION_TYPE,
            referenceId: normalizedInteractionId,
            idempotencyKey: `daily:${normalizedInteractionId}:xp`,
          }, { database: transactionDatabase });
          return Object.freeze({
            rewardGold: existingGold.amount,
            rewardShards: existingShards.amount,
            goldBalanceAfter: existingGold.balanceAfter,
            shardBalanceAfter: existingShards.balanceAfter,
            availableAt: cooldown.availableAt,
            rewardXp: xp.xpAwarded,
            xpAfter: xp.xpAfter,
            playerLevelAfter: xp.playerLevelAfter,
            leveledUp: xp.leveledUp,
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
        const xp = await playerService.awardXp({
          playerId: normalizedPlayerId,
          amount: daily.xpReward,
          sourceType: DAILY_TRANSACTION_TYPE,
          referenceId: normalizedInteractionId,
          idempotencyKey: `daily:${normalizedInteractionId}:xp`,
        }, { database: transactionDatabase });
        const updated = await cooldownRepository.setAvailableAt(transactionDatabase, {
          playerId: normalizedPlayerId,
          cooldownType: DAILY_COOLDOWN_TYPE,
          availableAt: addHours(currentTime, daily.cooldownHours),
        });
        return Object.freeze({
          rewardGold: String(rewardGold), rewardShards: String(rewardShards),
          goldBalanceAfter: gold.balanceAfter, shardBalanceAfter: shards.balanceAfter,
          rewardXp: xp.xpAwarded, xpAfter: xp.xpAfter,
          playerLevelAfter: xp.playerLevelAfter, leveledUp: xp.leveledUp,
          availableAt: updated.availableAt, replayed: false,
        });
      });
    },

    async weeklyReward({ playerId, interactionId }, { database } = {}) {
      const normalizedPlayerId = normalizePlayerId(playerId);
      const normalizedInteractionId = normalizeInteractionId(interactionId);
      return useTransaction(databasePool, database, async (transactionDatabase) => {
        const currentTime = await cooldownRepository.getDatabaseTime(transactionDatabase);
        const cooldown = await cooldownRepository.getOrCreateForUpdate(transactionDatabase, {
          playerId: normalizedPlayerId,
          cooldownType: WEEKLY_COOLDOWN_TYPE,
        });
        const goldKey = `weekly:${normalizedInteractionId}:gold`;
        const shardsKey = `weekly:${normalizedInteractionId}:shards`;
        const existingGold = await economyService.getTransactionByIdempotencyKey(
          goldKey,
          { database: transactionDatabase },
        );
        const existingShards = await economyService.getTransactionByIdempotencyKey(
          shardsKey,
          { database: transactionDatabase },
        );
        if (existingGold || existingShards) {
          if (
            !existingGold ||
            !existingShards ||
            existingGold.playerId !== normalizedPlayerId ||
            existingGold.currency !== EconomyCurrency.GOLD ||
            existingGold.transactionType !== WEEKLY_TRANSACTION_TYPE ||
            existingGold.referenceId !== normalizedInteractionId ||
            existingShards.playerId !== normalizedPlayerId ||
            existingShards.currency !== EconomyCurrency.SHARDS ||
            existingShards.transactionType !== WEEKLY_TRANSACTION_TYPE ||
            existingShards.referenceId !== normalizedInteractionId
          ) {
            throw new EconomyError(
              "IDEMPOTENCY_CONFLICT",
              "The interaction was already used for a different economy movement.",
            );
          }
          const xp = await playerService.awardXp({
            playerId: normalizedPlayerId,
            amount: weekly.xpReward,
            sourceType: WEEKLY_TRANSACTION_TYPE,
            referenceId: normalizedInteractionId,
            idempotencyKey: `weekly:${normalizedInteractionId}:xp`,
          }, { database: transactionDatabase });
          return Object.freeze({
            rewardGold: existingGold.amount,
            rewardShards: existingShards.amount,
            goldBalanceAfter: existingGold.balanceAfter,
            shardBalanceAfter: existingShards.balanceAfter,
            availableAt: cooldown.availableAt,
            rewardXp: xp.xpAwarded,
            xpAfter: xp.xpAfter,
            playerLevelAfter: xp.playerLevelAfter,
            leveledUp: xp.leveledUp,
            replayed: true,
          });
        }
        if (cooldown.availableAt > currentTime) {
          throw new RewardError(
            "WEEKLY_COOLDOWN_ACTIVE",
            "The weekly cooldown is still active.",
            { availableAt: cooldown.availableAt },
          );
        }
        const rewardGold = rollInteger(
          weekly.minimumGold,
          weekly.maximumGold + 1,
        );
        const rewardShards = rollInteger(
          weekly.minimumShards,
          weekly.maximumShards + 1,
        );
        if (
          !Number.isSafeInteger(rewardGold) ||
          rewardGold < weekly.minimumGold ||
          rewardGold > weekly.maximumGold ||
          !Number.isSafeInteger(rewardShards) ||
          rewardShards < weekly.minimumShards ||
          rewardShards > weekly.maximumShards
        ) {
          throw new Error("Weekly reward generator returned an invalid value.");
        }
        const gold = await economyService.credit({
          playerId: normalizedPlayerId,
          currency: EconomyCurrency.GOLD,
          amount: rewardGold,
          transactionType: WEEKLY_TRANSACTION_TYPE,
          referenceType: DISCORD_INTERACTION_REFERENCE,
          referenceId: normalizedInteractionId,
          idempotencyKey: goldKey,
        }, { database: transactionDatabase });
        const shards = await economyService.credit({
          playerId: normalizedPlayerId,
          currency: EconomyCurrency.SHARDS,
          amount: rewardShards,
          transactionType: WEEKLY_TRANSACTION_TYPE,
          referenceType: DISCORD_INTERACTION_REFERENCE,
          referenceId: normalizedInteractionId,
          idempotencyKey: shardsKey,
        }, { database: transactionDatabase });
        const xp = await playerService.awardXp({
          playerId: normalizedPlayerId,
          amount: weekly.xpReward,
          sourceType: WEEKLY_TRANSACTION_TYPE,
          referenceId: normalizedInteractionId,
          idempotencyKey: `weekly:${normalizedInteractionId}:xp`,
        }, { database: transactionDatabase });
        const updated = await cooldownRepository.setAvailableAt(transactionDatabase, {
          playerId: normalizedPlayerId,
          cooldownType: WEEKLY_COOLDOWN_TYPE,
          availableAt: addHours(currentTime, weekly.cooldownHours),
        });
        return Object.freeze({
          rewardGold: String(rewardGold),
          rewardShards: String(rewardShards),
          goldBalanceAfter: gold.balanceAfter,
          shardBalanceAfter: shards.balanceAfter,
          rewardXp: xp.xpAwarded,
          xpAfter: xp.xpAfter,
          playerLevelAfter: xp.playerLevelAfter,
          leveledUp: xp.leveledUp,
          availableAt: updated.availableAt,
          replayed: false,
        });
      });
    },
  });
}
