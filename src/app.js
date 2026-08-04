import { Events } from "discord.js";

import { createDiscordClient } from "./bot/client/discord-client.js";
import { commands } from "./bot/commands/index.js";
import { createInteractionCreateHandler } from "./bot/events/interaction-create.event.js";
import { gameConfig } from "./config/game-config.js";
import {
  checkPostgresConnection,
  createPostgresPool,
} from "./database/connection/postgres.js";
import { createEconomyService } from "./modules/economy/index.js";
import { createPlayerService } from "./modules/player/index.js";
import { createRewardService } from "./modules/reward/index.js";

export function createApplication({ discordToken, databaseUrl }) {
  const client = createDiscordClient();
  const databasePool = createPostgresPool({ connectionString: databaseUrl });
  const economyService = createEconomyService({ databasePool });
  const playerService = createPlayerService({
    databasePool,
    economyService,
  });
  const rewardService = createRewardService({
    databasePool,
    economyService,
    claimConfig: gameConfig.claim,
  });
  const services = Object.freeze({
    economy: economyService,
    player: playerService,
    reward: rewardService,
  });
  const commandRegistry = new Map(
    commands.map((command) => [command.data.name, command]),
  );
  let isStopped = false;

  client.once(Events.ClientReady, (readyClient) => {
    console.log(`SlamDunk is online as ${readyClient.user.tag}`);
  });

  client.on(
    Events.InteractionCreate,
    createInteractionCreateHandler(commandRegistry, { services }),
  );

  return Object.freeze({
    services,

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
