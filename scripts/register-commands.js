import { REST, Routes } from "discord.js";

import { commands } from "../src/bot/commands/index.js";
import { getDiscordCommandRegistrationConfig } from "../src/config/env.js";

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

async function registerCommands() {
  const config = getDiscordCommandRegistrationConfig();
  const commandPayload = commands.map((command) => command.data.toJSON());
  const rest = new REST({ version: "10" }).setToken(config.token);

  console.log(`Registering ${commandPayload.length} guild command(s).`);

  await rest.put(
    Routes.applicationGuildCommands(config.clientId, config.guildId),
    { body: commandPayload },
  );

  console.log("Guild commands registered successfully.");
}

registerCommands().catch((error) => {
  console.error(`Command registration failed: ${getErrorMessage(error)}`);
  process.exitCode = 1;
});
