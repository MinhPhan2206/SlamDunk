import { REST, Routes } from "discord.js";
import { pathToFileURL } from "node:url";

import { commands } from "../src/bot/commands/index.js";
import { getDiscordCommandRegistrationConfig } from "../src/config/env.js";

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

export function resolveRegistrationRoute(config) {
  return config.scope === "production"
    ? Routes.applicationCommands(config.clientId)
    : Routes.applicationGuildCommands(config.clientId, config.guildId);
}

export async function registerCommands(
  scope,
  {
    commandDefinitions = commands,
    configProvider = getDiscordCommandRegistrationConfig,
    restClient,
    logger = console,
  } = {},
) {
  const config = configProvider({ scope });
  const commandPayload = commandDefinitions.map((command) => command.data.toJSON());
  const rest = restClient ?? new REST({ version: "10" }).setToken(config.token);
  const target = config.scope === "production" ? "global" : "development guild";

  logger.log(`Registering ${commandPayload.length} ${target} command(s).`);

  await rest.put(
    resolveRegistrationRoute(config),
    { body: commandPayload },
  );

  logger.log(`${target === "global" ? "Global" : "Development guild"} commands registered successfully.`);
}

const isEntryPoint = process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntryPoint) {
  const scope = process.argv[2] ?? "development";
  registerCommands(scope).catch((error) => {
    console.error(`Command registration failed: ${getErrorMessage(error)}`);
    process.exitCode = 1;
  });
}
