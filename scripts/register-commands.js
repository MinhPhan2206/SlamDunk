import { REST, Routes } from "discord.js";

import { pingCommand } from "../src/bot/commands/ping.command.js";
import { getDiscordCommandRegistrationConfig } from "../src/config/env.js";

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

async function registerCommands() {
  const config = getDiscordCommandRegistrationConfig();
  const commands = [pingCommand.data.toJSON()];
  const rest = new REST({ version: "10" }).setToken(config.token);

  console.log(`Registering ${commands.length} guild command(s).`);

  await rest.put(
    Routes.applicationGuildCommands(config.clientId, config.guildId),
    { body: commands },
  );

  console.log("Guild commands registered successfully.");
}

registerCommands().catch((error) => {
  console.error(`Command registration failed: ${getErrorMessage(error)}`);
  process.exitCode = 1;
});
