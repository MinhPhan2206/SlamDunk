import { randomBytes, randomInt } from "node:crypto";

import { withTransaction } from "../../database/transaction/transaction-manager.js";
import {
  CARD_STAT_FIELDS,
  getActualCardStats,
} from "../card/index.js";
import { EconomyCurrency } from "../economy/index.js";
import { cooldownRepository } from "../reward/cooldown.repository.js";
import { BattleError } from "./battle.errors.js";
import { selectAiMatchup } from "./ai-matchup.js";
import { simulateBattle } from "./battle-engine.js";
import { battleRepository } from "./battle.repository.js";
import { calculateBattleReward } from "./battle-reward.js";
import {
  BATTLE_STRATEGY_RESOLVER_VERSION,
  deriveBattleSeed,
  resolveBattleStrategy,
  selectAiStrategy,
} from "./battle-strategy.js";
import { BATTLE_TRAIT_RESOLVER_VERSION } from "./battle-trait-resolver.js";
import { BATTLE_TENDENCY_RESOLVER_VERSION } from "./battle-tendency.js";

const BATTLE_COOLDOWN_TYPE = "BATTLE";
const BATTLE_TRANSACTION_TYPE = "BATTLE_REWARD";
const BATTLE_REFERENCE_TYPE = "BATTLE_MATCH";

function normalizeId(value, fieldName) {
  const normalized = String(value);
  if (!/^\d+$/.test(normalized) || BigInt(normalized) <= 0n) {
    throw new TypeError(`${fieldName} must be a positive integer.`);
  }
  return normalized;
}

function normalizeInteractionId(value) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new TypeError("interactionId must be a numeric string.");
  }
  return value;
}

function positiveInteger(config, field) {
  if (!Number.isSafeInteger(config?.[field]) || config[field] <= 0) {
    throw new TypeError(`battleConfig.${field} must be a positive integer.`);
  }
}

function probability(config, field, { allowNegative = false } = {}) {
  if (
    typeof config?.[field] !== "number" ||
    !Number.isFinite(config[field]) ||
    (!allowNegative && config[field] < 0)
  ) {
    throw new TypeError(`battleConfig.${field} must be a valid number.`);
  }
}

function nonNegativeNumber(value, field) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new TypeError(`battleConfig.${field} must be a non-negative number.`);
  }
}

function validateOpponentBrackets(brackets) {
  if (!Array.isArray(brackets) || brackets.length === 0) {
    throw new TypeError("battleConfig.opponentBrackets must not be empty.");
  }
  const codes = new Set();
  return Object.freeze(brackets.map((bracket) => {
    if (
      typeof bracket?.code !== "string" ||
      !/^[a-z][a-z-]*$/.test(bracket.code) ||
      codes.has(bracket.code) ||
      typeof bracket.displayName !== "string" ||
      !bracket.displayName.trim()
    ) {
      throw new TypeError("Each Battle opponent bracket requires a unique code and display name.");
    }
    codes.add(bracket.code);
    nonNegativeNumber(bracket.minimumLineupStrength, "opponentBrackets.minimumLineupStrength");
    if (!Number.isFinite(bracket.aiRatingOffset)) {
      throw new TypeError("battleConfig.opponentBrackets.aiRatingOffset must be finite.");
    }
    for (const field of ["rewardMultiplierBasisPoints"]) {
      if (!Number.isSafeInteger(bracket[field]) || bracket[field] < 0) {
        throw new TypeError(`battleConfig.opponentBrackets.${field} must be a non-negative integer.`);
      }
    }
    return Object.freeze({ ...bracket, displayName: bracket.displayName.trim() });
  }));
}

function validateConfig(config) {
  for (const field of [
    "engineVersion",
    "rulesetVersion",
    "configVersion",
    "strategyResolverVersion",
    "traitResolverVersion",
    "tendencyResolverVersion",
  ]) {
    if (typeof config?.[field] !== "string" || !config[field].trim()) {
      throw new TypeError(`battleConfig.${field} is required.`);
    }
  }
  if (config.strategyResolverVersion !== BATTLE_STRATEGY_RESOLVER_VERSION) {
    throw new TypeError("battleConfig.strategyResolverVersion is unsupported.");
  }
  if (config.traitResolverVersion !== BATTLE_TRAIT_RESOLVER_VERSION) {
    throw new TypeError("battleConfig.traitResolverVersion is unsupported.");
  }
  if (config.tendencyResolverVersion !== BATTLE_TENDENCY_RESOLVER_VERSION) {
    throw new TypeError("battleConfig.tendencyResolverVersion is unsupported.");
  }
  positiveInteger(config, "aiMatchupCandidatePoolSize");
  positiveInteger(config, "aiMatchupRatingTolerance");
  positiveInteger(config, "targetScore");
  positiveInteger(config, "maximumPossessions");
  for (const field of [
    "cooldownSeconds",
    "lossBaseGold",
    "lossPointGold",
    "winBaseGold",
    "winMarginGold",
  ]) positiveInteger(config, field);
  for (const field of ["firstFive", "nextFive", "afterTen"]) {
    positiveInteger(config.streakBonusBasisPointsPerWin, field);
  }
  for (const field of [
    "threePointBaseProbability",
    "midRangeBaseProbability",
    "finishingBaseProbability",
    "ratingProbabilityScale",
    "minimumShotProbability",
    "maximumShotProbability",
    "turnoverBaseProbability",
    "turnoverRatingScale",
    "offensiveReboundBaseProbability",
  ]) probability(config, field);
  if (
    config.minimumShotProbability >= config.maximumShotProbability ||
    config.maximumShotProbability > 1
  ) {
    throw new TypeError("Battle shot probability limits are invalid.");
  }
  for (const quality of [
    "OPEN",
    "LIGHTLY_CONTESTED",
    "CONTESTED",
    "HEAVILY_CONTESTED",
  ]) {
    probability(config.shotQualityModifiers, quality, { allowNegative: true });
  }
  return Object.freeze({
    ...config,
    opponentBrackets: validateOpponentBrackets(config.opponentBrackets),
  });
}

function statsFromTemplate(template) {
  return Object.freeze({
    finishing: template.finishing,
    midRange: template.midRange,
    threePoint: template.threePoint,
    playmaking: template.playmaking,
    perimeterDefense: template.perimeterDefense,
    interiorDefense: template.interiorDefense,
    strength: template.strength,
    heightCm: template.heightCm,
  });
}

function teamStrength(team) {
  const total = team.reduce((teamTotal, player) => {
    const actual = getActualCardStats(player.stats, player.cardLevel);
    return teamTotal + CARD_STAT_FIELDS.reduce(
      (statTotal, field) => statTotal + actual[field],
      0,
    ) / CARD_STAT_FIELDS.length;
  }, 0);
  return total / team.length;
}

function addSeconds(date, seconds) {
  return new Date(date.getTime() + seconds * 1_000);
}

export function createBattleService({
  databasePool,
  lineupService,
  cardInstanceService,
  cardTemplateService,
  traitService,
  playerService,
  economyService,
  battleConfig,
  generateSeed = () => randomInt(1, 2_147_483_647),
  generateMatchId = () => randomBytes(16).toString("hex"),
  resolveTraitModifier = () => 0,
}) {
  const config = validateConfig(battleConfig);
  if (!economyService?.credit) {
    throw new TypeError("Battle requires an Economy service.");
  }

  function getOpponentBracket(code) {
    const bracket = config.opponentBrackets.find((entry) => entry.code === code);
    if (!bracket) {
      throw new BattleError("BATTLE_BRACKET_INVALID", "Choose a valid opponent bracket.");
    }
    return bracket;
  }

  async function snapshotPlayerLineup(database, playerId) {
    const lineup = await lineupService.getLineup(playerId, { database });
    if (!lineup.complete) {
      throw new BattleError(
        "LINEUP_INCOMPLETE",
        "Complete all five lineup slots before starting a battle.",
      );
    }
    const players = [];
    for (const slot of lineup.slots) {
      const instance = await cardInstanceService.getInstance(slot.cardInstanceId, {
        database,
      });
      if (instance.ownerPlayerId !== playerId || instance.status !== "ACTIVE") {
        throw new BattleError(
          "LINEUP_CARD_INVALID",
          "Every lineup card must be active and owned by the Player.",
        );
      }
      const template = await cardTemplateService.getTemplate(
        instance.cardTemplateId,
        { database },
      );
      const traits = await traitService.getTraitsForTemplate(
        template.cardTemplateId,
        { database },
      );
      players.push(Object.freeze({
        slot: slot.slot,
        cardInstanceId: instance.cardInstanceId,
        cardTemplateId: template.cardTemplateId,
        cardLevel: instance.cardLevel,
        cardName: template.playerName,
        overall: template.overall,
        rarityCode: template.rarityCode,
        rarityName: template.rarityName,
        stats: statsFromTemplate(template),
        traits,
      }));
    }
    return Object.freeze({
      players: Object.freeze(players),
      strategy: resolveBattleStrategy(lineup.strategy),
    });
  }

  async function snapshotAiLineup(database, playerTeam, seed, bracket) {
    const templates = await cardTemplateService.listPackableTemplates({ database });
    const players = [];
    const matchup = selectAiMatchup({
      templates,
      playerTeam,
      seed,
      candidatePoolSize: config.aiMatchupCandidatePoolSize,
      ratingTolerance: config.aiMatchupRatingTolerance,
      ratingOffset: bracket.aiRatingOffset,
    });
    for (const { slot, template, cardLevel } of matchup) {
      const traits = await traitService.getTraitsForTemplate(
        template.cardTemplateId,
        { database },
      );
      players.push(Object.freeze({
        slot,
        cardInstanceId: null,
        cardTemplateId: template.cardTemplateId,
        cardLevel,
        cardName: template.playerName,
        overall: template.overall,
        rarityCode: template.rarityCode,
        rarityName: template.rarityName,
        stats: statsFromTemplate(template),
        traits,
      }));
    }
    return Object.freeze(players);
  }

  async function prepare(database, playerId, interactionId, opponentBracket) {
    await battleRepository.lockInteraction(database, interactionId);
    const existing = await battleRepository.findByInteractionId(
      database,
      interactionId,
    );
    if (existing) {
      if (existing.playerId !== playerId) {
        throw new BattleError("BATTLE_OWNER_MISMATCH", "This Battle belongs to another Player.");
      }
      if (existing.status === "COMPLETED") {
        return { result: await battleRepository.loadResult(database, existing) };
      }
      const snapshot = existing.inputSnapshot;
      return {
        match: existing,
        playerTeam: snapshot.playerTeam,
        aiTeam: snapshot.aiTeam,
        playerStrategy: snapshot.playerStrategy ?? resolveBattleStrategy(),
        aiStrategy: snapshot.aiStrategy ?? resolveBattleStrategy(),
        simulationSeed: snapshot.simulationSeed ?? deriveBattleSeed(
          existing.rngSeed,
          "simulation",
        ),
        bracket: snapshot.opponentBracket ?? config.opponentBrackets[0],
        lineupStrength: snapshot.lineupStrength ?? null,
        simulationConfig: snapshot.battleConfig ?? config,
        replayed: true,
      };
    }

    const rngSeed = generateSeed();
    const playerLineup = await snapshotPlayerLineup(database, playerId);
    const playerTeam = playerLineup.players;
    const playerStrategy = playerLineup.strategy;
    const bracket = getOpponentBracket(opponentBracket);
    const lineupStrength = teamStrength(playerTeam);
    if (lineupStrength < bracket.minimumLineupStrength) {
      throw new BattleError(
        "BATTLE_BRACKET_LOCKED",
        `${bracket.displayName} requires lineup strength ${bracket.minimumLineupStrength} or higher. Your lineup strength is ${lineupStrength.toFixed(1)}.`,
      );
    }
    const currentTime = await cooldownRepository.getDatabaseTime(database);
    const cooldown = await cooldownRepository.getOrCreateForUpdate(database, {
      playerId,
      cooldownType: BATTLE_COOLDOWN_TYPE,
    });
    if (cooldown.availableAt > currentTime) {
      throw new BattleError(
        "BATTLE_COOLDOWN_ACTIVE",
        "The Battle cooldown is still active.",
        { availableAt: cooldown.availableAt },
      );
    }
    const aiMatchupSeed = deriveBattleSeed(rngSeed, "ai-matchup");
    const aiOffenseStrategySeed = deriveBattleSeed(
      rngSeed,
      "ai-offense-strategy",
    );
    const aiDefenseStrategySeed = deriveBattleSeed(
      rngSeed,
      "ai-defense-strategy",
    );
    const simulationSeed = deriveBattleSeed(rngSeed, "simulation");
    const aiTeam = await snapshotAiLineup(
      database,
      playerTeam,
      aiMatchupSeed,
      bracket,
    );
    const aiStrategy = selectAiStrategy({
      team: aiTeam,
      offenseSeed: aiOffenseStrategySeed,
      defenseSeed: aiDefenseStrategySeed,
    });
    const publicMatchId = generateMatchId();
    if (!/^[0-9a-f]{32}$/.test(publicMatchId)) {
      throw new TypeError("Generated Battle Match ID must be 32 lowercase hexadecimal characters.");
    }
    const inputSnapshot = {
      playerTeam,
      aiTeam,
      battleConfig: config,
      opponentBracket: bracket,
      lineupStrength,
      playerStrategy,
      aiStrategy,
      strategySchemaVersion: playerStrategy.schemaVersion,
      strategyResolverVersion: BATTLE_STRATEGY_RESOLVER_VERSION,
      traitResolverVersion: BATTLE_TRAIT_RESOLVER_VERSION,
      tendencyResolverVersion: BATTLE_TENDENCY_RESOLVER_VERSION,
      simulationSeed,
    };
    const match = await battleRepository.createMatch(database, {
      playerId,
      publicMatchId,
      interactionId,
      rngSeed,
      engineVersion: config.engineVersion,
      rulesetVersion: config.rulesetVersion,
      configVersion: config.configVersion,
      inputSnapshot,
    });
    await cooldownRepository.setAvailableAt(database, {
      playerId,
      cooldownType: BATTLE_COOLDOWN_TYPE,
      availableAt: addSeconds(currentTime, config.cooldownSeconds),
    });
    return {
      match,
      playerTeam,
      aiTeam,
      playerStrategy,
      aiStrategy,
      simulationSeed,
      bracket,
      lineupStrength,
      simulationConfig: config,
      replayed: false,
    };
  }

  function simulate(prepared) {
    return simulateBattle({
      playerTeam: prepared.playerTeam,
      aiTeam: prepared.aiTeam,
      playerStrategy: prepared.playerStrategy,
      aiStrategy: prepared.aiStrategy,
      seed: prepared.simulationSeed,
      config: prepared.simulationConfig,
      resolveTraitModifier,
    });
  }

  async function finalize(database, prepared, simulation) {
    const match = await battleRepository.findByIdForUpdate(
      database,
      prepared.match.matchId,
    );
    if (!match) throw new BattleError("BATTLE_NOT_FOUND", "Battle was not found.");
    if (match.status === "COMPLETED") {
      return battleRepository.loadResult(database, match);
    }

    const playerTeamId = await battleRepository.createTeam(database, {
      matchId: match.matchId,
      playerId: match.playerId,
      teamNumber: 1,
      teamName: "Your Team",
      finalScore: simulation.playerScore,
    });
    const aiTeamId = await battleRepository.createTeam(database, {
      matchId: match.matchId,
      playerId: null,
      teamNumber: 2,
      teamName: "SlamDunk AI",
      finalScore: simulation.aiScore,
    });
    await battleRepository.createPlayers(database, playerTeamId, simulation.playerTeam);
    await battleRepository.createPlayers(database, aiTeamId, simulation.aiTeam);
    const playerBeforeBattle = await playerService.getPlayerById(match.playerId, {
      database,
    });
    const reward = calculateBattleReward({
      playerScore: simulation.playerScore,
      aiScore: simulation.aiScore,
      currentWinStreak: playerBeforeBattle.currentWinStreak,
      bracket: prepared.bracket,
      config,
    });
    const economyResult = await economyService.credit(
      {
        playerId: match.playerId,
        currency: EconomyCurrency.GOLD,
        amount: reward.rewardGold,
        transactionType: BATTLE_TRANSACTION_TYPE,
        referenceType: BATTLE_REFERENCE_TYPE,
        referenceId: match.publicMatchId,
        idempotencyKey: `battle:${match.publicMatchId}:gold`,
      },
      { database },
    );
    const rewardSnapshot = Object.freeze({
      ...reward,
      balanceAfter: economyResult.balanceAfter,
    });
    const completedMatch = await battleRepository.completeMatch(database, {
      matchId: match.matchId,
      winnerTeam: simulation.winnerTeam,
      possessionCount: simulation.possessionCount,
      playByPlay: simulation.playByPlay,
      rewardSnapshot,
    });
    await playerService.recordBattleResult(
      { playerId: match.playerId, won: simulation.winnerTeam === 1 },
      { database },
    );
    await cardInstanceService.recordGamesPlayed(
      {
        ownerPlayerId: match.playerId,
        cardInstanceIds: prepared.playerTeam.map((player) => player.cardInstanceId),
      },
      { database },
    );
    const result = await battleRepository.loadResult(database, completedMatch);
    return Object.freeze({
      ...result,
      reward: rewardSnapshot,
      replayed: prepared.replayed,
    });
  }

  return Object.freeze({
    async getCooldown(playerId, { database = databasePool } = {}) {
      const normalizedPlayerId = normalizeId(playerId, "playerId");
      const currentTime = await cooldownRepository.getDatabaseTime(database);
      const cooldown = await cooldownRepository.find(database, {
        playerId: normalizedPlayerId,
        cooldownType: BATTLE_COOLDOWN_TYPE,
      });
      return Object.freeze({
        cooldownType: BATTLE_COOLDOWN_TYPE,
        available: !cooldown || cooldown.availableAt <= currentTime,
        availableAt: cooldown?.availableAt ?? null,
        checkedAt: currentTime,
      });
    },

    async battle({ playerId, interactionId, opponentBracket }, { database } = {}) {
      const normalizedPlayerId = normalizeId(playerId, "playerId");
      const normalizedInteractionId = normalizeInteractionId(interactionId);
      const normalizedOpponentBracket = String(opponentBracket ?? "").trim().toLowerCase();

      if (database) {
        const prepared = await prepare(
          database,
          normalizedPlayerId,
          normalizedInteractionId,
          normalizedOpponentBracket,
        );
        if (prepared.result) return prepared.result;
        return finalize(database, prepared, simulate(prepared));
      }

      const prepared = await withTransaction(databasePool, (transactionDatabase) =>
        prepare(
          transactionDatabase,
          normalizedPlayerId,
          normalizedInteractionId,
          normalizedOpponentBracket,
        ),
      );
      if (prepared.result) return prepared.result;
      const simulation = simulate(prepared);
      return withTransaction(databasePool, (transactionDatabase) =>
        finalize(transactionDatabase, prepared, simulation),
      );
    },
  });
}
