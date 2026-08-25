import dotenv from "dotenv";

dotenv.config({ quiet: true });

const NODE_ENVIRONMENTS = Object.freeze(["development", "test", "production"]);
const ECONOMY_PROFILES = Object.freeze(["development", "production"]);
const DATABASE_SSL_MODES = Object.freeze(["disable", "require", "verify-full"]);

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

function nodeEnvironment() {
  const value = requireEnvironmentVariable("NODE_ENV");
  if (!NODE_ENVIRONMENTS.includes(value)) {
    throw new Error(
      "Invalid NODE_ENV. Expected development, test, or production.",
    );
  }
  return value;
}

function economyProfile(environment) {
  const value = process.env.ECONOMY_CONFIG_PROFILE?.trim() ||
    (environment === "production" ? null : "development");
  if (!value) {
    throw new Error(
      "Missing required environment variable: ECONOMY_CONFIG_PROFILE",
    );
  }
  if (!ECONOMY_PROFILES.includes(value)) {
    throw new Error(
      "ECONOMY_CONFIG_PROFILE must be development or production.",
    );
  }
  if (environment === "production" && value !== "production") {
    throw new Error(
      "Production requires ECONOMY_CONFIG_PROFILE=production.",
    );
  }
  return value;
}

function databaseSslConfig(environment) {
  const mode = process.env.DATABASE_SSL_MODE?.trim() ||
    (environment === "production" ? null : "disable");
  if (!mode) {
    throw new Error("Missing required environment variable: DATABASE_SSL_MODE");
  }
  if (!DATABASE_SSL_MODES.includes(mode)) {
    throw new Error(
      "DATABASE_SSL_MODE must be disable, require, or verify-full.",
    );
  }
  if (environment === "production" && mode === "disable") {
    throw new Error("Production database TLS cannot be disabled.");
  }
  return Object.freeze({
    sslMode: mode,
    ssl: mode === "disable"
      ? false
      : Object.freeze({ rejectUnauthorized: mode === "verify-full" }),
  });
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
  const value = process.env.COMMAND_PREFIX?.trim().toLowerCase() || "sd";
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

function communityAccessConfig({ allowGuildFallback = true } = {}) {
  const duelChannelIds = optionalSnowflakeList(
    "DISCORD_COMMUNITY_DUEL_CHANNEL_IDS",
  );
  return Object.freeze({
    guildId: optionalSnowflake("DISCORD_COMMUNITY_GUILD_ID") ??
      (allowGuildFallback ? optionalSnowflake("DISCORD_GUILD_ID") : null),
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

function validateProductionCommunityAccess(communityAccess) {
  if (!communityAccess.guildId) {
    throw new Error(
      "Production requires DISCORD_COMMUNITY_GUILD_ID.",
    );
  }
  const requiredChannels = [
    ["DISCORD_COMMUNITY_TRADE_CHANNEL_IDS", communityAccess.tradeChannelIds],
    ["DISCORD_COMMUNITY_BATTLE_CHANNEL_IDS", communityAccess.battleChannelIds],
    ["DISCORD_COMMUNITY_DUEL_CHANNEL_IDS", communityAccess.duelChannelIds],
  ];
  for (const [name, channelIds] of requiredChannels) {
    if (channelIds.length === 0) {
      throw new Error(`Production requires at least one ID in ${name}.`);
    }
  }
}

export function getApplicationRuntimeConfig() {
  const environment = nodeEnvironment();
  const selectedEconomyProfile = economyProfile(environment);
  const communityAccess = communityAccessConfig({
    allowGuildFallback: environment !== "production",
  });
  if (environment === "production") {
    requireEnvironmentVariable("DISCORD_CLIENT_ID");
    validateProductionCommunityAccess(communityAccess);
  }
  const databaseSsl = databaseSslConfig(environment);

  return Object.freeze({
    nodeEnvironment: environment,
    economyProfile: selectedEconomyProfile,
    discordToken: requireEnvironmentVariable("DISCORD_TOKEN"),
    communityInviteUrl: optionalUrl("DISCORD_COMMUNITY_INVITE_URL"),
    communityAccess,
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
      enforceEligibility: environment === "production",
      minimumPlayerLevel: optionalPositiveInteger("SECURITY_MINIMUM_PLAYER_LEVEL", 5),
      minimumDiscordAccountAgeDays: optionalPositiveInteger(
        "SECURITY_MINIMUM_DISCORD_ACCOUNT_AGE_DAYS",
        7,
      ),
      maximumHeavyOperations: optionalPositiveInteger(
        "SECURITY_MAXIMUM_HEAVY_OPERATIONS",
        4,
      ),
      maximumRateWindows: optionalPositiveInteger(
        "SECURITY_MAXIMUM_RATE_WINDOWS",
        50_000,
      ),
      rateWindowCleanupMilliseconds: optionalPositiveInteger(
        "SECURITY_RATE_WINDOW_CLEANUP_MS",
        60_000,
      ),
      violationFlushIntervalMilliseconds: optionalPositiveInteger(
        "SECURITY_VIOLATION_FLUSH_INTERVAL_MS",
        60_000,
      ),
      maximumPendingViolations: optionalPositiveInteger(
        "SECURITY_MAXIMUM_PENDING_VIOLATIONS",
        2_000,
      ),
      maximumViolationsPerFlush: optionalPositiveInteger(
        "SECURITY_MAXIMUM_VIOLATIONS_PER_FLUSH",
        500,
      ),
      healthLogIntervalMilliseconds: optionalPositiveInteger(
        "HEALTH_LOG_INTERVAL_MS",
        300_000,
      ),
    }),
    database: Object.freeze({
      ...databaseSsl,
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

export function getSanitizedStartupConfig(config) {
  return Object.freeze({
    event: "SLAMDUNK_STARTUP_CONFIG",
    environment: config.nodeEnvironment,
    economyProfile: config.economyProfile,
    databaseTls: config.database?.sslMode ?? "unknown",
    communityGuildConfigured: Boolean(config.communityAccess?.guildId),
    communityChannelCounts: Object.freeze({
      trade: config.communityAccess?.tradeChannelIds?.length ?? 0,
      battle: config.communityAccess?.battleChannelIds?.length ?? 0,
      duel: config.communityAccess?.duelChannelIds?.length ?? 0,
    }),
    securityEnforcement: Boolean(config.security?.enforceEligibility),
  });
}

export function getDatabaseConfig() {
  return Object.freeze({
    databaseUrl: requireEnvironmentVariable("DATABASE_URL"),
  });
}

function databaseIdentity(value, name) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid PostgreSQL URL.`);
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error(`${name} must be a valid PostgreSQL URL.`);
  }
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!url.hostname || !databaseName) {
    throw new Error(`${name} must include a host and database name.`);
  }
  return Object.freeze({
    host: url.hostname.toLowerCase(),
    port: url.port || "5432",
    databaseName,
  });
}

export function getTestDatabaseConfig() {
  if (process.env.NODE_ENV?.trim() === "production") {
    throw new Error("Tests cannot run with NODE_ENV=production.");
  }

  const testDatabaseUrl = requireEnvironmentVariable("TEST_DATABASE_URL");
  const testIdentity = databaseIdentity(testDatabaseUrl, "TEST_DATABASE_URL");
  const runtimeDatabaseUrl = process.env.DATABASE_URL?.trim();
  if (runtimeDatabaseUrl) {
    const runtimeIdentity = databaseIdentity(runtimeDatabaseUrl, "DATABASE_URL");
    const sameDatabase = testIdentity.host === runtimeIdentity.host &&
      testIdentity.port === runtimeIdentity.port &&
      testIdentity.databaseName === runtimeIdentity.databaseName;
    if (sameDatabase) {
      throw new Error(
        "TEST_DATABASE_URL must not target the same database as DATABASE_URL.",
      );
    }
  }

  return Object.freeze({ databaseUrl: testDatabaseUrl });
}

export function getDiscordCommandRegistrationConfig(
  { scope = "development" } = {},
) {
  if (!["development", "production"].includes(scope)) {
    throw new Error("Command registration scope must be development or production.");
  }

  const environment = nodeEnvironment();
  if (scope === "production" && environment !== "production") {
    throw new Error(
      "Global command registration requires NODE_ENV=production.",
    );
  }

  const config = {
    token: requireEnvironmentVariable("DISCORD_TOKEN"),
    clientId: requireEnvironmentVariable("DISCORD_CLIENT_ID"),
    scope,
  };
  if (scope === "development") {
    config.guildId = requireEnvironmentVariable("DISCORD_GUILD_ID");
  }
  return Object.freeze(config);
}
