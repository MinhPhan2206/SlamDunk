import { securityRepository } from "./security.repository.js";

const FEATURE_LABELS = Object.freeze({
  MARKET: "Market trading",
  TRADE: "Direct Trade",
  DUEL_BET: "Wagered Duel",
});

function normalizePlayerIds(values) {
  const input = Array.isArray(values) ? values : [values];
  const normalized = [...new Set(input.map((value) => String(value ?? "")))];
  if (
    normalized.length === 0 ||
    normalized.some((value) => !/^\d+$/.test(value) || BigInt(value) <= 0n)
  ) {
    throw new TypeError("playerId must be a positive integer.");
  }
  return normalized;
}

function restrictionActive(value, timestamp) {
  return value != null && new Date(value).getTime() > timestamp;
}

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

  const normalizeEvent = (input) => Object.freeze({
    eventType: String(input.eventType ?? "UNKNOWN").slice(0, 64),
    severity: String(input.severity ?? "WARNING").slice(0, 16),
    discordUserId: input.discordUserId ? String(input.discordUserId) : null,
    guildId: input.guildId ? String(input.guildId) : null,
    channelId: input.channelId ? String(input.channelId) : null,
    commandName: input.commandName ? String(input.commandName).slice(0, 64) : null,
    metadata: input.metadata ?? {},
  });

  const loadProfiles = async (playerIds, database = databasePool) => {
    const normalizedIds = normalizePlayerIds(playerIds);
    const profiles = await securityRepository.findPlayerProfilesForShare(
      database,
      normalizedIds,
    );
    return {
      playerIds: normalizedIds,
      profiles: new Map(profiles.map((profile) => [String(profile.player_id), profile])),
    };
  };

  const assertActive = ({ playerIds, profiles }, timestamp) => {
    for (const playerId of playerIds) {
      const profile = profiles.get(playerId);
      if (restrictionActive(profile?.disabled_until, timestamp)) {
        throw new SecurityAccessError(
          "PLAYER_DISABLED",
          "This account is temporarily restricted. Contact SlamDunk support.",
        );
      }
    }
  };

  const assertTrading = ({ playerIds, profiles }, timestamp) => {
    assertActive({ playerIds, profiles }, timestamp);
    for (const playerId of playerIds) {
      const profile = profiles.get(playerId);
      if (restrictionActive(profile?.trading_frozen_until, timestamp)) {
        throw new SecurityAccessError(
          "TRADING_FROZEN",
          "Trading features are temporarily unavailable for this account.",
        );
      }
    }
  };

  return Object.freeze({
    async scanAbuseSignals() {
      return securityRepository.scanAbuseSignals(databasePool);
    },

    async recordEvent(input) {
      return securityRepository.createEvent(databasePool, normalizeEvent(input));
    },

    async recordEvents(inputs) {
      if (!Array.isArray(inputs) || inputs.length === 0) return 0;
      return securityRepository.createEvents(
        databasePool,
        inputs.map(normalizeEvent),
      );
    },

    async assertPlayerActive(
      { playerId, playerIds },
      { database = databasePool } = {},
    ) {
      const state = await loadProfiles(playerIds ?? playerId, database);
      assertActive(state, Date.now());
    },

    async assertCanEarn(
      { playerId },
      { database = databasePool } = {},
    ) {
      const state = await loadProfiles(playerId, database);
      const timestamp = Date.now();
      assertActive(state, timestamp);
      const profile = state.profiles.get(state.playerIds[0]);
      if (restrictionActive(profile?.earning_frozen_until, timestamp)) {
        throw new SecurityAccessError(
          "EARNINGS_FROZEN",
          "System rewards are temporarily unavailable for this account.",
        );
      }
    },

    async assertCanTrade(
      { playerIds },
      { database = databasePool } = {},
    ) {
      const state = await loadProfiles(playerIds, database);
      assertTrading(state, Date.now());
    },

    async assertAccess({ player, discordUser, feature }) {
      const state = await loadProfiles(player.playerId);
      const now = Date.now();
      if (["MARKET", "TRADE", "DUEL_BET"].includes(feature)) {
        assertTrading(state, now);
      } else {
        assertActive(state, now);
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
