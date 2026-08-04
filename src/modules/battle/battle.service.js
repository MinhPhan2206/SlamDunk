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

function validateConfig(config) {
  const integerFields = [
    "aiCardLevel",
    "levelRatingBonus",
    "baseTeamScore",
    "randomScoreRange",
    "minimumScore",
    "maximumScore",
  ];
  for (const field of integerFields) {
    if (!Number.isSafeInteger(config?.[field]) || config[field] < 0) {
      throw new TypeError(`battleConfig.${field} must be a non-negative integer.`);
    }
  }
  if (
    config.aiCardLevel < 1 ||
    config.aiCardLevel > 5 ||
    typeof config.matchupScale !== "number" ||
    config.matchupScale < 0 ||
    config.minimumScore >= config.maximumScore
  ) {
    throw new TypeError("Battle configuration is invalid.");
  }
  return Object.freeze({ ...config });
}

function statsFromTemplate(template) {
  return Object.freeze({
    insideScoring: template.insideScoring,
    midRange: template.midRange,
    threePoint: template.threePoint,
    playmaking: template.playmaking,
    perimeterDefense: template.perimeterDefense,
    interiorDefense: template.interiorDefense,
    rebounding: template.rebounding,
    athleticism: template.athleticism,
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
      .sort(
        (left, right) => {
          if (right.overall !== left.overall) {
            return right.overall - left.overall;
          }
          return BigInt(left.cardTemplateId) < BigInt(right.cardTemplateId)
            ? -1
            : 1;
        },
      )[0];
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
      players.push(
        Object.freeze({
          slot: slot.slot,
          cardInstanceId: instance.cardInstanceId,
          cardTemplateId: template.cardTemplateId,
          cardLevel: instance.cardLevel,
          cardName: `${template.playerName} - ${template.edition}`,
          stats: statsFromTemplate(template),
          traits,
        }),
      );
    }
    return Object.freeze(players);
  }

  async function snapshotAiLineup(database) {
    const templates = await cardTemplateService.listPackableTemplates({ database });
    const selectedTemplates = chooseAiTemplates(templates);
    const players = [];
    for (const { slot, template } of selectedTemplates) {
      const traits = await traitService.getTraitsForTemplate(
        template.cardTemplateId,
        { database },
      );
      players.push(
        Object.freeze({
          slot,
          cardInstanceId: null,
          cardTemplateId: template.cardTemplateId,
          cardLevel: config.aiCardLevel,
          cardName: `${template.playerName} - ${template.edition}`,
          stats: statsFromTemplate(template),
          traits,
        }),
      );
    }
    return Object.freeze(players);
  }

  return Object.freeze({
    async battle({ playerId, interactionId }, { database } = {}) {
      const normalizedPlayerId = normalizeId(playerId, "playerId");
      const normalizedInteractionId = normalizeInteractionId(interactionId);
      const operation = async (transactionDatabase) => {
        await battleRepository.lockInteraction(
          transactionDatabase,
          normalizedInteractionId,
        );
        const existing = await battleRepository.findByInteractionId(
          transactionDatabase,
          normalizedInteractionId,
        );
        if (existing) {
          return battleRepository.loadResult(transactionDatabase, existing);
        }

        const playerTeam = await snapshotPlayerLineup(
          transactionDatabase,
          normalizedPlayerId,
        );
        const aiTeam = await snapshotAiLineup(transactionDatabase);
        const seed = generateSeed();
        const simulation = simulateBattle({
          playerTeam,
          aiTeam,
          seed,
          config,
        });
        const match = await battleRepository.createMatch(transactionDatabase, {
          playerId: normalizedPlayerId,
          interactionId: normalizedInteractionId,
          rngSeed: seed,
        });
        const playerTeamId = await battleRepository.createTeam(
          transactionDatabase,
          {
            matchId: match.matchId,
            playerId: normalizedPlayerId,
            teamNumber: 1,
            teamName: "Your Team",
            finalScore: simulation.playerScore,
          },
        );
        const aiTeamId = await battleRepository.createTeam(transactionDatabase, {
          matchId: match.matchId,
          playerId: null,
          teamNumber: 2,
          teamName: "SlamDunk AI",
          finalScore: simulation.aiScore,
        });
        await battleRepository.createPlayers(
          transactionDatabase,
          playerTeamId,
          simulation.playerTeam,
        );
        await battleRepository.createPlayers(
          transactionDatabase,
          aiTeamId,
          simulation.aiTeam,
        );
        const completedMatch = await battleRepository.completeMatch(
          transactionDatabase,
          { matchId: match.matchId, winnerTeam: simulation.winnerTeam },
        );
        await playerService.recordBattleResult(
          { playerId: normalizedPlayerId, won: simulation.winnerTeam === 1 },
          { database: transactionDatabase },
        );
        await cardInstanceService.recordGamesPlayed(
          {
            ownerPlayerId: normalizedPlayerId,
            cardInstanceIds: playerTeam.map((player) => player.cardInstanceId),
          },
          { database: transactionDatabase },
        );
        const result = await battleRepository.loadResult(
          transactionDatabase,
          completedMatch,
        );
        return Object.freeze({ ...result, replayed: false });
      };

      return database
        ? operation(database)
        : withTransaction(databasePool, operation);
    },
  });
}
