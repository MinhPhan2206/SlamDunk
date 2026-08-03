import dotenv from "dotenv";

dotenv.config({ quiet: true });

function requireEnvironmentVariable(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getDiscordRuntimeConfig() {
  return Object.freeze({
    token: requireEnvironmentVariable("DISCORD_TOKEN"),
  });
}

export function getDiscordCommandRegistrationConfig() {
  return Object.freeze({
    token: requireEnvironmentVariable("DISCORD_TOKEN"),
    clientId: requireEnvironmentVariable("DISCORD_CLIENT_ID"),
    guildId: requireEnvironmentVariable("DISCORD_GUILD_ID"),
  });
}
