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
import { createVoteService } from "./modules/vote/index.js";
import { createTopGgClient } from "./integrations/topgg/index.js";
import { createLevelRewardService } from "./modules/level-reward/index.js";
import { createContractService } from "./modules/contract/index.js";
import { createAbuseGuard, createSecurityService } from "./modules/security/index.js";
import { createOperationalMonitor } from "./operations/operational-monitor.js";

export function createApplication({
  discordToken,
  databaseUrl,
  communityInviteUrl,
  communityAccess = Object.freeze({}),
  topGg = Object.freeze({}),
  security: securityConfig = Object.freeze({}),
  database: databaseConfig = Object.freeze({}),
  commandAvailability = Object.freeze({}),
  commandPrefix = "dunk",
}) {
  const client = createDiscordClient();
  const databasePool = createPostgresPool({
    connectionString: databaseUrl,
    ...databaseConfig,
  });
  const securityService = createSecurityService({
    databasePool,
    config: securityConfig,
  });
  const abuseGuard = createAbuseGuard({
    maximumHeavyOperations: securityConfig.maximumHeavyOperations,
    onViolation: (event) => securityService.recordEvent({
      eventType: event.eventType,
      discordUserId: event.userId,
      guildId: event.guildId === "dm" ? null : event.guildId,
      channelId: event.channelId === "unknown" ? null : event.channelId,
      commandName: event.commandName,
      metadata: { kind: event.kind, retryAfterMs: event.retryAfterMs },
    }),
  });
  const operationalMonitor = createOperationalMonitor({
    databasePool,
    abuseGuard,
    intervalMilliseconds: securityConfig.healthLogIntervalMilliseconds,
  });
  const economyService = createEconomyService({ databasePool });
  const playerService = createPlayerService({
    databasePool,
    economyService,
  });
  const inventoryService = createInventoryService({
    databasePool,
    itemDefinitions: gameConfig.items,
  });
  const rewardService = createRewardService({
    databasePool,
    economyService,
    playerService,
    claimConfig: gameConfig.claim,
    dailyConfig: gameConfig.daily,
    weeklyConfig: gameConfig.weekly,
  });
  const topGgClient = createTopGgClient({ apiToken: topGg.apiToken });
  const voteService = createVoteService({
    databasePool,
    economyService,
    topGgClient,
    voteConfig: gameConfig.vote,
    botId: topGg.botId,
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
  const levelRewardService = createLevelRewardService({
    databasePool,
    economyService,
    inventoryService,
    cardTemplateService,
    cardInstanceService,
    levelRewardConfig: gameConfig.levelRewards,
  });
  const contractService = createContractService({
    databasePool,
    inventoryService,
    cardTemplateService,
    cardInstanceService,
    contractCatalog: gameConfig.contracts,
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
    vote: voteService,
    levelReward: levelRewardService,
    contract: contractService,
    security: securityService,
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
    communityAccess,
    abuseGuard,
    commandAvailability,
  });
  let isStopped = false;
  let marketExpirationTimer = null;
  let duelExpirationTimer = null;
  let abuseScanTimer = null;

  const expireMarketListings = async () => {
    try {
      await marketService.expireDueListings();
    } catch (error) {
      console.error(`Market expiration failed: ${error.message}`);
    }
  };

  const expireDuelChallenges = async () => {
    try {
      await battleService.expireDueDuelChallenges();
    } catch (error) {
      console.error(`Duel expiration failed: ${error.message}`);
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
      operationalMonitor.start();
      await dropService.completeExpiredOffers();
      await tradeService.expireDueTrades();
      await marketService.expireDueListings();
      await battleService.expireDueDuelChallenges();
      marketExpirationTimer = setInterval(() => {
        void expireMarketListings();
      }, 60_000);
      marketExpirationTimer.unref?.();
      duelExpirationTimer = setInterval(() => {
        void expireDuelChallenges();
      }, 30_000);
      duelExpirationTimer.unref?.();
      abuseScanTimer = setInterval(() => {
        void securityService.scanAbuseSignals().then((events) => {
          if (events.length > 0) {
            console.warn(`Security scan recorded ${events.length} abuse signal(s).`);
          }
        }).catch((error) => {
          console.error(`Security abuse scan failed: ${error.message}`);
        });
      }, 15 * 60_000);
      abuseScanTimer.unref?.();
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
      if (duelExpirationTimer) {
        clearInterval(duelExpirationTimer);
        duelExpirationTimer = null;
      }
      if (abuseScanTimer) {
        clearInterval(abuseScanTimer);
        abuseScanTimer = null;
      }
      battlePlayback.stop();
      strategyDrafts.stop();
      operationalMonitor.stop();
      abuseGuard.stop();
      client.destroy();
      await databasePool.end();
    },
  });
}
