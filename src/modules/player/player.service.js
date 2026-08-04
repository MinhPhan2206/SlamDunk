import { withTransaction } from "../../database/transaction/transaction-manager.js";
import { playerRepository } from "./player.repository.js";

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

export function createPlayerService({ databasePool, economyService }) {
  return Object.freeze({
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
