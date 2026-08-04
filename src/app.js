import { Events } from "discord.js";

import { createDiscordClient } from "./bot/client/discord-client.js";
import { pingCommand } from "./bot/commands/ping.command.js";
import { createInteractionCreateHandler } from "./bot/events/interaction-create.event.js";
import {
  checkPostgresConnection,
  createPostgresPool,
} from "./database/connection/postgres.js";
import { createEconomyService } from "./modules/economy/index.js";
import { createPlayerService } from "./modules/player/index.js";

export function createApplication({ discordToken, databaseUrl }) {
  const client = createDiscordClient();
  const databasePool = createPostgresPool({ connectionString: databaseUrl });
  const economyService = createEconomyService({ databasePool });
  const playerService = createPlayerService({
    databasePool,
    economyService,
  });
  const commands = new Map([[pingCommand.data.name, pingCommand]]);
  let isStopped = false;

  client.once(Events.ClientReady, (readyClient) => {
    console.log(`SlamDunk is online as ${readyClient.user.tag}`);
  });

  client.on(
    Events.InteractionCreate,
    createInteractionCreateHandler(commands),
  );

  return Object.freeze({
    services: Object.freeze({
      economy: economyService,
      player: playerService,
    }),

    async start() {
      await checkPostgresConnection(databasePool);
      console.log("PostgreSQL connection established.");
      await client.login(discordToken);
    },

    async stop() {
      if (isStopped) {
        return;
      }

      isStopped = true;
      client.destroy();
      await databasePool.end();
    },
  });
}
