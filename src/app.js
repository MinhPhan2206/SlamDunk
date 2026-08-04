import { Events } from "discord.js";

import { createDiscordClient } from "./bot/client/discord-client.js";
import { commands } from "./bot/commands/index.js";
import { components } from "./bot/components/index.js";
import { createInteractionCreateHandler } from "./bot/events/interaction-create.event.js";
import { gameConfig } from "./config/game-config.js";
import {
  checkPostgresConnection,
  createPostgresPool,
} from "./database/connection/postgres.js";
import {
  createCardInstanceService,
  createCardTemplateService,
} from "./modules/card/index.js";
import { createEconomyService } from "./modules/economy/index.js";
import { createCollectionService } from "./modules/collection/index.js";
import { createLineupService } from "./modules/lineup/index.js";
import { createPlayerService } from "./modules/player/index.js";
import { createPackService } from "./modules/pack/index.js";
import { createRewardService } from "./modules/reward/index.js";
import { createTraitService } from "./modules/trait/index.js";

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
  const cardTemplateService = createCardTemplateService({ databasePool });
  const traitService = createTraitService({
    databasePool,
    cardTemplateService,
  });
  const cardInstanceService = createCardInstanceService({
    databasePool,
    cardTemplateService,
    playerService,
  });
  const packService = createPackService({
    databasePool,
    cardInstanceService,
    cardTemplateService,
    freeDropConfig: gameConfig.freeDrop,
  });
  const collectionService = createCollectionService({ databasePool });
  const lineupService = createLineupService({ databasePool });
  const services = Object.freeze({
    cardInstance: cardInstanceService,
    cardTemplate: cardTemplateService,
    collection: collectionService,
    lineup: lineupService,
    economy: economyService,
    pack: packService,
    player: playerService,
    reward: rewardService,
    trait: traitService,
  });
  const commandRegistry = new Map(
    commands.map((command) => [command.data.name, command]),
  );
  const componentRegistry = new Map(
    components.map((component) => [component.namespace, component]),
  );
  let isStopped = false;

  client.once(Events.ClientReady, (readyClient) => {
    console.log(`SlamDunk is online as ${readyClient.user.tag}`);
  });

  client.on(
    Events.InteractionCreate,
    createInteractionCreateHandler(
      commandRegistry,
      { services },
      componentRegistry,
    ),
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
