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

export function createPlayerService({ databasePool, economyService }) {
  return Object.freeze({
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
