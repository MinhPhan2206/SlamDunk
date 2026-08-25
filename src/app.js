import { Events } from "discord.js";
import { fileURLToPath } from "node:url";

import { createDiscordClient } from "./bot/client/discord-client.js";
import { createBattlePlayback } from "./bot/battle/battle-playback.js";
import { commands } from "./bot/commands/index.js";
import { components } from "./bot/components/index.js";
import { createInteractionCreateHandler } from "./bot/events/interaction-create.event.js";
import { createMessageCreateHandler } from "./bot/events/message-create.event.js";
import { createPrefixCommandRegistry } from "./bot/prefix/prefix-command-registry.js";
import { createStrategyDraftStore } from "./bot/strategy/strategy-draft-store.js";
import { getGameConfig } from "./config/game-config.js";
import {
  checkPostgresConnection,
  createPostgresPool,
} from "./database/connection/postgres.js";
import { assertSchemaCurrent } from "./database/migrations/migration-runner.js";
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
import {
  createAbuseGuard,
  createSecurityEventAggregator,
  createSecurityService,
} from "./modules/security/index.js";
import { createOperationalMonitor } from "./operations/operational-monitor.js";
import { getCardStripCacheSnapshot } from "./bot/ui/card-strip-image.js";
import { getImageRuntimeSnapshot } from "./bot/ui/image-runtime.js";

const MIGRATIONS_DIRECTORY = fileURLToPath(
  new URL("../migrations/", import.meta.url),
);

export function createApplication({
  discordToken,
  databaseUrl,
  communityInviteUrl,
  communityAccess = Object.freeze({}),
  topGg = Object.freeze({}),
  security: securityConfig = Object.freeze({}),
  database: databaseConfig = Object.freeze({}),
  commandAvailability = Object.freeze({}),
  commandPrefix = "sd",
  economyProfile = "development",
}) {
  const gameConfig = getGameConfig(economyProfile);
  const client = createDiscordClient();
  const databasePool = createPostgresPool({
    connectionString: databaseUrl,
    ...databaseConfig,
  });
  const securityService = createSecurityService({
    databasePool,
    config: securityConfig,
  });
  const securityEventAggregator = createSecurityEventAggregator({
    writeEvents: (events) => securityService.recordEvents(events),
    flushIntervalMs: securityConfig.violationFlushIntervalMilliseconds,
    maximumPendingKeys: securityConfig.maximumPendingViolations,
    maximumEventsPerFlush: securityConfig.maximumViolationsPerFlush,
  });
  const abuseGuard = createAbuseGuard({
    maximumHeavyOperations: securityConfig.maximumHeavyOperations,
    maximumTrackedWindows: securityConfig.maximumRateWindows,
    cleanupIntervalMs: securityConfig.rateWindowCleanupMilliseconds,
    onViolation: (event) => securityEventAggregator.record({
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
    securityEventMetrics: () => securityEventAggregator.snapshot(),
    imageMetrics: () => ({
      cache: getCardStripCacheSnapshot(),
      runtime: getImageRuntimeSnapshot(),
    }),
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
    securityService,
    claimConfig: gameConfig.claim,
    dailyConfig: gameConfig.daily,
    weeklyConfig: gameConfig.weekly,
  });
  const topGgClient = createTopGgClient({ apiToken: topGg.apiToken });
  const voteService = createVoteService({
    databasePool,
    economyService,
    securityService,
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
    securityService,
  });
  const levelRewardService = createLevelRewardService({
    databasePool,
    economyService,
    inventoryService,
    cardTemplateService,
    cardInstanceService,
    securityService,
    levelRewardConfig: gameConfig.levelRewards,
  });
  const contractService = createContractService({
    databasePool,
    inventoryService,
    cardTemplateService,
    cardInstanceService,
    securityService,
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
    securityService,
    dropConfig: gameConfig.drop,
  });
  const packService = createPackService({
    packCatalog: gameConfig.packs,
    databasePool,
    economyService,
    cardTemplateService,
    cardInstanceService,
    securityService,
  });
  const collectionService = createCollectionService({ databasePool });
  const lineupService = createLineupService({ databasePool, securityService });
  const onboardingService = createOnboardingService({
    databasePool,
    cardTemplateService,
    cardInstanceService,
    lineupService,
    securityService,
  });
  const battleService = createBattleService({
    databasePool,
    lineupService,
    cardInstanceService,
    cardTemplateService,
    traitService,
    playerService,
    economyService,
    securityService,
    battleConfig: gameConfig.battle,
  });
  const battlePlayback = createBattlePlayback({
    playbackConfig: gameConfig.battlePlayback,
  });
  const strategyDrafts = createStrategyDraftStore();
  const quicksellService = createQuicksellService({
    databasePool,
    economyService,
    securityService,
    quicksellConfig: gameConfig.quicksell,
  });
  const upgradeService = createUpgradeService({
    databasePool,
    cardInstanceService,
    securityService,
    upgradeConfig: gameConfig.upgrade,
  });
  const marketService = createMarketService({
    databasePool,
    cardInstanceService,
    economyService,
    securityService,
  });
  const tradeService = createTradeService({
    databasePool,
    cardInstanceService,
    economyService,
    inventoryService,
    playerService,
    securityService,
    tradeConfig: gameConfig.trade,
  });
  const exchangeService = createExchangeService({
    databasePool,
    economyService,
    securityService,
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
      const schema = await assertSchemaCurrent(databasePool, MIGRATIONS_DIRECTORY);
      console.log(`Database schema current at ${schema.latestMigration}.`);
      abuseGuard.start();
      securityEventAggregator.start();
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
      try {
        await securityEventAggregator.stop();
      } catch (error) {
        console.error(`Final security event flush failed: ${error.message}`);
      }
      await databasePool.end();
    },
  });
}
