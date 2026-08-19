import { Events } from "discord.js";

import { createDiscordClient } from "./bot/client/discord-client.js";
import { createBattlePlayback } from "./bot/battle/battle-playback.js";
import { commands } from "./bot/commands/index.js";
import { components } from "./bot/components/index.js";
import { createInteractionCreateHandler } from "./bot/events/interaction-create.event.js";
import { createMessageCreateHandler } from "./bot/events/message-create.event.js";
import { createPrefixCommandRegistry } from "./bot/prefix/prefix-command-registry.js";
import { createStrategyDraftStore } from "./bot/strategy/strategy-draft-store.js";
import { gameConfig } from "./config/game-config.js";
import {
  checkPostgresConnection,
  createPostgresPool,
} from "./database/connection/postgres.js";
import {
  createCardInstanceService,
  createCardTemplateService,
  createCardViewService,
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
import { createExchangeService } from "./modules/exchange/index.js";
import { createInventoryService } from "./modules/inventory/index.js";
import { createOnboardingService } from "./modules/onboarding/index.js";

export function createApplication({
  discordToken,
  databaseUrl,
  communityInviteUrl,
  commandPrefix = "dunk",
}) {
  const client = createDiscordClient();
  const databasePool = createPostgresPool({ connectionString: databaseUrl });
  const economyService = createEconomyService({ databasePool });
  const playerService = createPlayerService({
    databasePool,
    economyService,
  });
  const inventoryService = createInventoryService({
    databasePool,
    itemDefinitions: [{
      itemType: gameConfig.upgrade.levelUpItemType,
      itemName: gameConfig.upgrade.levelUpItemName,
    }],
  });
  const rewardService = createRewardService({
    databasePool,
    economyService,
    playerService,
    claimConfig: gameConfig.claim,
    dailyConfig: gameConfig.daily,
    weeklyConfig: gameConfig.weekly,
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
  const cardViewService = createCardViewService({
    databasePool,
    traitService,
  });
  const dropService = createDropService({
    databasePool,
    cardInstanceService,
    cardTemplateService,
    dropConfig: gameConfig.drop,
  });
  const packService = createPackService({
    packCatalog: gameConfig.packs,
    databasePool,
    economyService,
    cardTemplateService,
    cardInstanceService,
  });
  const collectionService = createCollectionService({ databasePool });
  const lineupService = createLineupService({ databasePool });
  const onboardingService = createOnboardingService({
    databasePool,
    cardTemplateService,
    cardInstanceService,
    lineupService,
  });
  const battleService = createBattleService({
    databasePool,
    lineupService,
    cardInstanceService,
    cardTemplateService,
    traitService,
    playerService,
    economyService,
    battleConfig: gameConfig.battle,
  });
  const battlePlayback = createBattlePlayback({
    playbackConfig: gameConfig.battlePlayback,
  });
  const strategyDrafts = createStrategyDraftStore();
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
    tradeConfig: gameConfig.trade,
  });
  const exchangeService = createExchangeService({
    databasePool,
    economyService,
    exchangeConfig: gameConfig.exchange,
    upgradeConfig: gameConfig.upgrade,
  });
  const services = Object.freeze({
    battle: battleService,
    cardInstance: cardInstanceService,
    cardTemplate: cardTemplateService,
    cardView: cardViewService,
    collection: collectionService,
    lineup: lineupService,
    economy: economyService,
    exchange: exchangeService,
    drop: dropService,
    pack: packService,
    player: playerService,
    reward: rewardService,
    quicksell: quicksellService,
    upgrade: upgradeService,
    market: marketService,
    trade: tradeService,
    trait: traitService,
    inventory: inventoryService,
    onboarding: onboardingService,
  });
  const commandRegistry = new Map(
    commands.map((command) => [command.data.name, command]),
  );
  const componentRegistry = new Map(
    components.map((component) => [component.namespace, component]),
  );
  const prefixCommandRegistry = createPrefixCommandRegistry(commands);
  const commandContext = Object.freeze({
    services,
    battlePlayback,
    strategyDrafts,
    communityInviteUrl,
  });
  let isStopped = false;
  let marketExpirationTimer = null;

  const expireMarketListings = async () => {
    try {
      await marketService.expireDueListings();
    } catch (error) {
      console.error(`Market expiration failed: ${error.message}`);
    }
  };

  client.once(Events.ClientReady, (readyClient) => {
    console.log(`SlamDunk is online as ${readyClient.user.tag}`);
  });

  client.on(
    Events.InteractionCreate,
    createInteractionCreateHandler(
      commandRegistry,
      commandContext,
      componentRegistry,
    ),
  );
  client.on(
    Events.MessageCreate,
    createMessageCreateHandler({
      prefix: commandPrefix,
      registry: prefixCommandRegistry,
      context: commandContext,
    }),
  );

  return Object.freeze({
    services,

    async start() {
      await checkPostgresConnection(databasePool);
      console.log("PostgreSQL connection established.");
      await dropService.completeExpiredOffers();
      await tradeService.expireDueTrades();
      await marketService.expireDueListings();
      marketExpirationTimer = setInterval(() => {
        void expireMarketListings();
      }, 60_000);
      marketExpirationTimer.unref?.();
      await client.login(discordToken);
    },

    async stop() {
      if (isStopped) {
        return;
      }

      isStopped = true;
      if (marketExpirationTimer) {
        clearInterval(marketExpirationTimer);
        marketExpirationTimer = null;
      }
      battlePlayback.stop();
      strategyDrafts.stop();
      client.destroy();
      await databasePool.end();
    },
  });
}
