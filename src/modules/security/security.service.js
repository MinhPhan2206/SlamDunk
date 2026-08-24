import { securityRepository } from "./security.repository.js";

const FEATURE_LABELS = Object.freeze({
  MARKET: "Market trading",
  TRADE: "Direct Trade",
  DUEL_BET: "Wagered Duel",
});

export class SecurityAccessError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "SecurityAccessError";
    this.code = code;
  }
}

export function createSecurityService({ databasePool, config = {} }) {
  const minimumPlayerLevel = config.minimumPlayerLevel ?? 5;
  const minimumDiscordAccountAgeDays = config.minimumDiscordAccountAgeDays ?? 7;
  const enforceEligibility = config.enforceEligibility === true;

  return Object.freeze({
    async scanAbuseSignals() {
      return securityRepository.scanAbuseSignals(databasePool);
    },

    async recordEvent(input) {
      return securityRepository.createEvent(databasePool, {
        eventType: String(input.eventType ?? "UNKNOWN").slice(0, 64),
        severity: String(input.severity ?? "WARNING").slice(0, 16),
        discordUserId: input.discordUserId ? String(input.discordUserId) : null,
        guildId: input.guildId ? String(input.guildId) : null,
        channelId: input.channelId ? String(input.channelId) : null,
        commandName: input.commandName ? String(input.commandName).slice(0, 64) : null,
        metadata: input.metadata ?? {},
      });
    },

    async assertAccess({ player, discordUser, feature }) {
      const profile = await securityRepository.findPlayerProfile(
        databasePool,
        player.playerId,
      );
      const now = Date.now();
      if (profile?.disabled_until && new Date(profile.disabled_until).getTime() > now) {
        throw new SecurityAccessError(
          "PLAYER_DISABLED",
          "This account is temporarily restricted. Contact SlamDunk support.",
        );
      }
      if (
        ["MARKET", "TRADE", "DUEL_BET"].includes(feature) &&
        profile?.trading_frozen_until &&
        new Date(profile.trading_frozen_until).getTime() > now
      ) {
        throw new SecurityAccessError(
          "TRADING_FROZEN",
          "Trading features are temporarily unavailable for this account.",
        );
      }
      if (!enforceEligibility) return;

      const label = FEATURE_LABELS[feature] ?? feature;
      if (player.playerLevel < minimumPlayerLevel) {
        throw new SecurityAccessError(
          "PLAYER_LEVEL_REQUIRED",
          `${label} unlocks at Player Level ${minimumPlayerLevel}.`,
        );
      }
      const createdAt = Number(discordUser?.createdTimestamp ?? 0);
      const minimumAgeMs = minimumDiscordAccountAgeDays * 86_400_000;
      if (!createdAt || now - createdAt < minimumAgeMs) {
        throw new SecurityAccessError(
          "DISCORD_ACCOUNT_TOO_NEW",
          `${label} requires a Discord account at least ${minimumDiscordAccountAgeDays} days old.`,
        );
      }
    },
  });
}
