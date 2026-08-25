import { withTransaction } from "../../database/transaction/transaction-manager.js";
import { calculatePlayerLevel, getPlayerLevelProgress } from "./player-progression.js";
import { playerRepository } from "./player.repository.js";

const CODE_PATTERN = /^[A-Z][A-Z0-9_]*$/;

function validateDiscordUserId(discordUserId) {
  if (typeof discordUserId !== "string" || !/^\d+$/.test(discordUserId)) {
    throw new TypeError("discordUserId must be a numeric string.");
  }
}

function validateUsernameSnapshot(usernameSnapshot) {
  if (
    typeof usernameSnapshot !== "string" ||
    usernameSnapshot.trim().length === 0
  ) {
    throw new TypeError("usernameSnapshot must be a non-empty string.");
  }
}

function validatePlayerId(playerId) {
  const value = String(playerId);

  if (!/^\d+$/.test(value) || BigInt(value) <= 0n) {
    throw new TypeError("playerId must be a positive integer.");
  }

  return value;
}

function validateXpAward(input) {
  if (!input || typeof input !== "object") {
    throw new TypeError("XP award input is required.");
  }
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) {
    throw new TypeError("XP amount must be a positive safe integer.");
  }
  if (typeof input.sourceType !== "string" || !CODE_PATTERN.test(input.sourceType)) {
    throw new TypeError("XP sourceType must be an uppercase code.");
  }
  for (const field of ["referenceId", "idempotencyKey"]) {
    if (typeof input[field] !== "string" || !input[field].trim()) {
      throw new TypeError(`XP ${field} must be a non-empty string.`);
    }
  }
  return Object.freeze({
    playerId: validatePlayerId(input.playerId),
    amount: input.amount,
    sourceType: input.sourceType,
    referenceId: input.referenceId.trim(),
    idempotencyKey: input.idempotencyKey.trim(),
  });
}

function createXpAwardResult(transaction, { previousLevel, replayed }) {
  return Object.freeze({
    xpAwarded: String(transaction.amount),
    xpAfter: transaction.xpAfter,
    playerLevelAfter: transaction.playerLevelAfter,
    leveledUp: previousLevel == null
      ? false
      : transaction.playerLevelAfter > previousLevel,
    levelsGained: previousLevel == null
      ? 0
      : transaction.playerLevelAfter - previousLevel,
    progressAfter: getPlayerLevelProgress(transaction.xpAfter),
    replayed,
  });
}

export function createPlayerService({ databasePool, economyService }) {
  return Object.freeze({
    async awardXp(input, { database } = {}) {
      const normalized = validateXpAward(input);
      const operation = async (transactionDatabase) => {
        const player = await playerRepository.findByIdForUpdate(
          transactionDatabase,
          normalized.playerId,
        );
        if (!player) throw new Error("Player was not found for XP award.");

        const existing = await playerRepository.findXpTransactionByIdempotencyKey(
          transactionDatabase,
          normalized.idempotencyKey,
        );
        if (existing) {
          if (
            existing.playerId !== normalized.playerId ||
            existing.amount !== normalized.amount ||
            existing.sourceType !== normalized.sourceType ||
            existing.referenceId !== normalized.referenceId
          ) {
            throw new Error("XP idempotency key conflicts with another award.");
          }
          const previousXp = BigInt(existing.xpAfter) - BigInt(existing.amount);
          return createXpAwardResult(existing, {
            previousLevel: calculatePlayerLevel(previousXp),
            replayed: true,
          });
        }

        const xpAfter = BigInt(player.xp) + BigInt(normalized.amount);
        const playerLevelAfter = calculatePlayerLevel(xpAfter);
        await playerRepository.updateProgression(transactionDatabase, {
          playerId: normalized.playerId,
          xp: xpAfter.toString(),
          playerLevel: playerLevelAfter,
        });
        const transaction = await playerRepository.createXpTransaction(
          transactionDatabase,
          {
            ...normalized,
            xpAfter: xpAfter.toString(),
            playerLevelAfter,
          },
        );
        return createXpAwardResult(transaction, {
          previousLevel: player.playerLevel,
          replayed: false,
        });
      };
      return database
        ? operation(database)
        : withTransaction(databasePool, operation);
    },

    async recordBattleResult(
      { playerId, won },
      { database = databasePool } = {},
    ) {
      if (typeof won !== "boolean") {
        throw new TypeError("won must be a boolean.");
      }
      return playerRepository.recordBattleResult(database, {
        playerId: validatePlayerId(playerId),
        won,
      });
    },

    async getPlayerById(playerId, { database = databasePool } = {}) {
      return playerRepository.findById(database, validatePlayerId(playerId));
    },

    async getPlayersByIds(playerIds, { database = databasePool } = {}) {
      if (!Array.isArray(playerIds) || playerIds.length === 0) {
        throw new TypeError("playerIds must be a non-empty array.");
      }
      const normalizedIds = [...new Set(playerIds.map(validatePlayerId))];
      const players = await playerRepository.findByIds(database, normalizedIds);
      const playersById = new Map(
        players.map((player) => [String(player.playerId), player]),
      );
      return Object.freeze(normalizedIds
        .map((playerId) => playersById.get(playerId))
        .filter(Boolean));
    },

    async getPlayer(discordUserId) {
      validateDiscordUserId(discordUserId);
      return playerRepository.findByDiscordUserId(databasePool, discordUserId);
    },

    async getOrCreatePlayer({ discordUserId, usernameSnapshot }) {
      validateDiscordUserId(discordUserId);
      validateUsernameSnapshot(usernameSnapshot);

      return withTransaction(databasePool, async (database) => {
        const player = await playerRepository.upsertFromDiscord(database, {
          discordUserId,
          usernameSnapshot: usernameSnapshot.trim(),
        });

        await economyService.ensureWallet(player.playerId, { database });
        return player;
      });
    },
  });
}
