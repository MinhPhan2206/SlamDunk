import dotenv from "dotenv";

dotenv.config({ quiet: true });

function requireEnvironmentVariable(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function optionalUrl(name) {
  const value = process.env[name]?.trim();
  if (!value) return null;

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid HTTPS URL.`);
  }
  if (url.protocol !== "https:") {
    throw new Error(`${name} must be a valid HTTPS URL.`);
  }
  return url.toString();
}

function optionalEnvironmentVariable(name) {
  return process.env[name]?.trim() || null;
}

function optionalBoolean(name, fallback = false) {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${name} must be true or false.`);
}

function optionalCommandList(name) {
  const value = process.env[name]?.trim();
  if (!value) return Object.freeze([]);
  const commands = [...new Set(value.split(",").map((entry) =>
    entry.trim().toLowerCase()).filter(Boolean))];
  if (commands.some((command) => !/^[a-z][a-z0-9-]{0,31}$/.test(command))) {
    throw new Error(`${name} must be a comma-separated list of command names.`);
  }
  return Object.freeze(commands);
}

function optionalPositiveInteger(name, fallback) {
  const value = process.env[name]?.trim();
  if (!value) return fallback;
  if (!/^\d+$/.test(value) || Number(value) < 1 || !Number.isSafeInteger(Number(value))) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return Number(value);
}

function commandPrefix() {
  const value = process.env.COMMAND_PREFIX?.trim().toLowerCase() || "dunk";
  if (!/^[a-z][a-z0-9_-]{0,15}$/.test(value)) {
    throw new Error(
      "COMMAND_PREFIX must contain 1-16 lowercase letters, numbers, underscores, or hyphens.",
    );
  }
  return value;
}

function optionalSnowflake(name) {
  const value = process.env[name]?.trim();
  if (!value) return null;
  if (!/^\d{17,20}$/.test(value)) {
    throw new Error(`${name} must be a Discord ID.`);
  }
  return value;
}

function optionalSnowflakeList(name) {
  const value = process.env[name]?.trim();
  if (!value) return Object.freeze([]);
  const ids = [...new Set(value.split(",").map((id) => id.trim()).filter(Boolean))];
  if (ids.some((id) => !/^\d{17,20}$/.test(id))) {
    throw new Error(`${name} must be a comma-separated list of Discord IDs.`);
  }
  return Object.freeze(ids);
}

function communityAccessConfig() {
  const duelChannelIds = optionalSnowflakeList(
    "DISCORD_COMMUNITY_DUEL_CHANNEL_IDS",
  );
  return Object.freeze({
    guildId: optionalSnowflake("DISCORD_COMMUNITY_GUILD_ID") ??
      optionalSnowflake("DISCORD_GUILD_ID"),
    tradeChannelIds: optionalSnowflakeList(
      "DISCORD_COMMUNITY_TRADE_CHANNEL_IDS",
    ),
    battleChannelIds: optionalSnowflakeList(
      "DISCORD_COMMUNITY_BATTLE_CHANNEL_IDS",
    ),
    duelChannelIds: duelChannelIds.length > 0
      ? duelChannelIds
      : optionalSnowflakeList("DISCORD_COMMUNITY_DUEL_BET_CHANNEL_IDS"),
  });
}

export function getApplicationRuntimeConfig() {
  const nodeEnvironment = process.env.NODE_ENV?.trim().toLowerCase() || "development";
  return Object.freeze({
    discordToken: requireEnvironmentVariable("DISCORD_TOKEN"),
    communityInviteUrl: optionalUrl("DISCORD_COMMUNITY_INVITE_URL"),
    communityAccess: communityAccessConfig(),
    topGg: Object.freeze({
      apiToken: optionalEnvironmentVariable("TOPGG_API_TOKEN"),
      botId: optionalSnowflake("TOPGG_BOT_ID") ??
        optionalSnowflake("DISCORD_CLIENT_ID"),
    }),
    commandPrefix: commandPrefix(),
    commandAvailability: Object.freeze({
      maintenanceMode: optionalBoolean("MAINTENANCE_MODE"),
      disabledCommands: optionalCommandList("DISABLED_COMMANDS"),
    }),
    security: Object.freeze({
      enforceEligibility: nodeEnvironment === "production",
      minimumPlayerLevel: optionalPositiveInteger("SECURITY_MINIMUM_PLAYER_LEVEL", 5),
      minimumDiscordAccountAgeDays: optionalPositiveInteger(
        "SECURITY_MINIMUM_DISCORD_ACCOUNT_AGE_DAYS",
        7,
      ),
      maximumHeavyOperations: optionalPositiveInteger(
        "SECURITY_MAXIMUM_HEAVY_OPERATIONS",
        4,
      ),
      healthLogIntervalMilliseconds: optionalPositiveInteger(
        "HEALTH_LOG_INTERVAL_MS",
        300_000,
      ),
    }),
    database: Object.freeze({
      maximumConnections: optionalPositiveInteger("DATABASE_POOL_MAX", 5),
      connectionTimeoutMilliseconds: optionalPositiveInteger(
        "DATABASE_CONNECTION_TIMEOUT_MS",
        5_000,
      ),
      idleTimeoutMilliseconds: optionalPositiveInteger(
        "DATABASE_IDLE_TIMEOUT_MS",
        30_000,
      ),
      statementTimeoutMilliseconds: optionalPositiveInteger(
        "DATABASE_STATEMENT_TIMEOUT_MS",
        15_000,
      ),
    }),
    ...getDatabaseConfig(),
  });
}

export function getDatabaseConfig() {
  return Object.freeze({
    databaseUrl: requireEnvironmentVariable("DATABASE_URL"),
  });
}

export function getDiscordCommandRegistrationConfig() {
  return Object.freeze({
    token: requireEnvironmentVariable("DISCORD_TOKEN"),
    clientId: requireEnvironmentVariable("DISCORD_CLIENT_ID"),
    guildId: requireEnvironmentVariable("DISCORD_GUILD_ID"),
  });
}
