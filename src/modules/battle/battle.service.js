import { randomInt } from "node:crypto";

import { withTransaction } from "../../database/transaction/transaction-manager.js";
import { BattleError } from "./battle.errors.js";
import { simulateBattle } from "./battle-engine.js";
import { battleRepository } from "./battle.repository.js";

const SLOTS = Object.freeze(["PG", "SG", "SF", "PF", "C"]);

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

function validateConfig(config) {
  for (const field of ["engineVersion", "rulesetVersion", "configVersion"]) {
    if (typeof config?.[field] !== "string" || !config[field].trim()) {
      throw new TypeError(`battleConfig.${field} is required.`);
    }
  }
  positiveInteger(config, "aiCardLevel");
  positiveInteger(config, "targetScore");
  positiveInteger(config, "maximumPossessions");
  if (
    config.aiCardLevel > 5 ||
    !Number.isSafeInteger(config.levelRatingBonus) ||
    config.levelRatingBonus < 0
  ) {
    throw new TypeError("Battle Card Level configuration is invalid.");
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
  return Object.freeze({ ...config });
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

function chooseAiTemplates(templates) {
  const unused = new Set(templates.map((template) => template.cardTemplateId));
  return SLOTS.map((slot) => {
    const selected = templates
      .filter(
        (template) =>
          unused.has(template.cardTemplateId) &&
          [template.primaryPosition, template.secondaryPosition].includes(slot),
      )
      .sort((left, right) => {
        if (right.overall !== left.overall) return right.overall - left.overall;
        return BigInt(left.cardTemplateId) < BigInt(right.cardTemplateId) ? -1 : 1;
      })[0];
    if (!selected) {
      throw new BattleError(
        "AI_LINEUP_UNAVAILABLE",
        `The Card catalog cannot fill the AI ${slot} slot.`,
      );
    }
    unused.delete(selected.cardTemplateId);
    return { slot, template: selected };
  });
}

export function createBattleService({
  databasePool,
  lineupService,
  cardInstanceService,
  cardTemplateService,
  traitService,
  playerService,
  battleConfig,
  generateSeed = () => randomInt(1, 2_147_483_647),
  resolveTraitModifier = () => 0,
}) {
  const config = validateConfig(battleConfig);

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
        stats: statsFromTemplate(template),
        traits,
      }));
    }
    return Object.freeze(players);
  }

  async function snapshotAiLineup(database) {
    const templates = await cardTemplateService.listPackableTemplates({ database });
    const players = [];
    for (const { slot, template } of chooseAiTemplates(templates)) {
      const traits = await traitService.getTraitsForTemplate(
        template.cardTemplateId,
        { database },
      );
      players.push(Object.freeze({
        slot,
        cardInstanceId: null,
        cardTemplateId: template.cardTemplateId,
        cardLevel: config.aiCardLevel,
        cardName: template.playerName,
        stats: statsFromTemplate(template),
        traits,
      }));
    }
    return Object.freeze(players);
  }

  async function prepare(database, playerId, interactionId) {
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
      return {
        match: existing,
        playerTeam: existing.inputSnapshot.playerTeam,
        aiTeam: existing.inputSnapshot.aiTeam,
        simulationConfig: existing.inputSnapshot.battleConfig ?? config,
        replayed: true,
      };
    }

    const playerTeam = await snapshotPlayerLineup(database, playerId);
    const aiTeam = await snapshotAiLineup(database);
    const rngSeed = generateSeed();
    const inputSnapshot = { playerTeam, aiTeam, battleConfig: config };
    const match = await battleRepository.createMatch(database, {
      playerId,
      interactionId,
      rngSeed,
      engineVersion: config.engineVersion,
      rulesetVersion: config.rulesetVersion,
      configVersion: config.configVersion,
      inputSnapshot,
    });
    return {
      match,
      playerTeam,
      aiTeam,
      simulationConfig: config,
      replayed: false,
    };
  }

  function simulate(prepared) {
    return simulateBattle({
      playerTeam: prepared.playerTeam,
      aiTeam: prepared.aiTeam,
      seed: prepared.match.rngSeed,
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
    const completedMatch = await battleRepository.completeMatch(database, {
      matchId: match.matchId,
      winnerTeam: simulation.winnerTeam,
      possessionCount: simulation.possessionCount,
      playByPlay: simulation.playByPlay,
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
    return Object.freeze({ ...result, replayed: prepared.replayed });
  }

  return Object.freeze({
    async battle({ playerId, interactionId }, { database } = {}) {
      const normalizedPlayerId = normalizeId(playerId, "playerId");
      const normalizedInteractionId = normalizeInteractionId(interactionId);

      if (database) {
        const prepared = await prepare(
          database,
          normalizedPlayerId,
          normalizedInteractionId,
        );
        if (prepared.result) return prepared.result;
        return finalize(database, prepared, simulate(prepared));
      }

      const prepared = await withTransaction(databasePool, (transactionDatabase) =>
        prepare(transactionDatabase, normalizedPlayerId, normalizedInteractionId),
      );
      if (prepared.result) return prepared.result;
      const simulation = simulate(prepared);
      return withTransaction(databasePool, (transactionDatabase) =>
        finalize(transactionDatabase, prepared, simulation),
      );
    },
  });
}
