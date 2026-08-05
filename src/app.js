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
import { createBattleService } from "./modules/battle/index.js";
import { createEconomyService } from "./modules/economy/index.js";
import { createCollectionService } from "./modules/collection/index.js";
import { createLineupService } from "./modules/lineup/index.js";
import { createPlayerService } from "./modules/player/index.js";
import { createDropService } from "./modules/drop/index.js";
import { createPackService } from "./modules/pack/index.js";
import { createRewardService } from "./modules/reward/index.js";
import { createQuicksellService } from "./modules/quicksell/index.js";
import { createTraitService } from "./modules/trait/index.js";
import { createUpgradeService } from "./modules/upgrade/index.js";
import { createMarketService } from "./modules/market/index.js";
import { createTradeService } from "./modules/trade/index.js";

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
  const dropService = createDropService({
    databasePool,
    cardInstanceService,
    cardTemplateService,
    dropConfig: gameConfig.drop,
  });
  const packService = createPackService({ packCatalog: gameConfig.packs });
  const collectionService = createCollectionService({ databasePool });
  const lineupService = createLineupService({ databasePool });
  const battleService = createBattleService({
    databasePool,
    lineupService,
    cardInstanceService,
    cardTemplateService,
    traitService,
    playerService,
    battleConfig: gameConfig.battle,
  });
  const quicksellService = createQuicksellService({
    databasePool,
    economyService,
    quicksellConfig: gameConfig.quicksell,
  });
  const upgradeService = createUpgradeService({
    databasePool,
    cardInstanceService,
    upgradeConfig: gameConfig.upgrade,
  });
  const marketService = createMarketService({
    databasePool,
    cardInstanceService,
    economyService,
  });
  const tradeService = createTradeService({
    databasePool,
    cardInstanceService,
    economyService,
    playerService,
  });
  const services = Object.freeze({
    battle: battleService,
    cardInstance: cardInstanceService,
    cardTemplate: cardTemplateService,
    collection: collectionService,
    lineup: lineupService,
    economy: economyService,
    drop: dropService,
    pack: packService,
    player: playerService,
    reward: rewardService,
    quicksell: quicksellService,
    upgrade: upgradeService,
    market: marketService,
    trade: tradeService,
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
