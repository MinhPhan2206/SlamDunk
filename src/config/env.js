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

export function getApplicationRuntimeConfig() {
  return Object.freeze({
    discordToken: requireEnvironmentVariable("DISCORD_TOKEN"),
    communityInviteUrl: optionalUrl("DISCORD_COMMUNITY_INVITE_URL"),
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
