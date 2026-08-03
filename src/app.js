import { Events } from "discord.js";

import { createDiscordClient } from "./bot/client/discord-client.js";
import { pingCommand } from "./bot/commands/ping.command.js";
import { createInteractionCreateHandler } from "./bot/events/interaction-create.event.js";

export function createApplication({ discordToken }) {
  const client = createDiscordClient();
  const commands = new Map([[pingCommand.data.name, pingCommand]]);

  client.once(Events.ClientReady, (readyClient) => {
    console.log(`SlamDunk is online as ${readyClient.user.tag}`);
  });

  client.on(
    Events.InteractionCreate,
    createInteractionCreateHandler(commands),
  );

  return Object.freeze({
    async start() {
      await client.login(discordToken);
    },

    stop() {
      client.destroy();
    },
  });
}
