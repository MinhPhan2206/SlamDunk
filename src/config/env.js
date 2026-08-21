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
  return Object.freeze({
    guildId: optionalSnowflake("DISCORD_COMMUNITY_GUILD_ID") ??
      optionalSnowflake("DISCORD_GUILD_ID"),
    tradeChannelIds: optionalSnowflakeList(
      "DISCORD_COMMUNITY_TRADE_CHANNEL_IDS",
    ),
    battleChannelIds: optionalSnowflakeList(
      "DISCORD_COMMUNITY_BATTLE_CHANNEL_IDS",
    ),
    duelBetChannelIds: optionalSnowflakeList(
      "DISCORD_COMMUNITY_DUEL_BET_CHANNEL_IDS",
    ),
  });
}

export function getApplicationRuntimeConfig() {
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
