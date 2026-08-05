import { randomInt } from "node:crypto";

import { withTransaction } from "../../database/transaction/transaction-manager.js";
import { cooldownRepository } from "../reward/cooldown.repository.js";
import { buildRarityOdds } from "../rarity/rarity-odds.js";
import { DropError } from "./drop.errors.js";
import { dropSessionRepository } from "./drop-session.repository.js";

const FREE_DROP_TYPE = "FREE_DROP";
const FREE_DROP_COOLDOWN_TYPE = "FREE_DROP";

function normalizeId(value, fieldName) {
  const normalized = String(value);

  if (!/^\d+$/.test(normalized) || BigInt(normalized) <= 0n) {
    throw new TypeError(`${fieldName} must be a positive integer.`);
  }

  return normalized;
}

function normalizeInteractionId(interactionId) {
  if (typeof interactionId !== "string" || !/^\d+$/.test(interactionId)) {
    throw new TypeError("interactionId must be a numeric string.");
  }

  return interactionId;
}

function normalizeCandidatePosition(candidatePosition, maximum) {
  if (
    !Number.isInteger(candidatePosition) ||
    candidatePosition < 1 ||
    candidatePosition > maximum
  ) {
    throw new TypeError(
      `candidatePosition must be an integer from 1 through ${maximum}.`,
    );
  }

  return candidatePosition;
}

function validateConfig(config) {
  if (
    !Number.isSafeInteger(config?.selectionSeconds) ||
    config.selectionSeconds <= 0
  ) {
    throw new TypeError("dropConfig.selectionSeconds must be positive.");
  }
  if (
    !Number.isSafeInteger(config?.cooldownMinutes) ||
    config.cooldownMinutes <= 0
  ) {
    throw new TypeError("dropConfig.cooldownMinutes must be positive.");
  }

  if (
    !Number.isSafeInteger(config?.candidateCount) ||
    config.candidateCount < 2 ||
    config.candidateCount > 10
  ) {
    throw new TypeError(
      "dropConfig.candidateCount must be an integer from 2 through 10.",
    );
  }

  if (!Array.isArray(config.rarityWeights) || config.rarityWeights.length !== 7) {
    throw new TypeError("dropConfig.rarityWeights must define 7 tiers.");
  }

  const seenTiers = new Set();
  const rarityWeights = config.rarityWeights.map(({ rarityTier, weight }) => {
    if (
      !Number.isInteger(rarityTier) ||
      rarityTier < 1 ||
      rarityTier > 7 ||
      seenTiers.has(rarityTier) ||
      !Number.isSafeInteger(weight) ||
      weight <= 0
    ) {
      throw new TypeError("Each rarity weight must have a unique Tier 1–7 and a positive weight.");
    }

    seenTiers.add(rarityTier);
    return Object.freeze({ rarityTier, weight });
  });

  return Object.freeze({
    cooldownMinutes: config.cooldownMinutes,
    candidateCount: config.candidateCount,
    selectionSeconds: config.selectionSeconds,
    rarityWeights: Object.freeze(rarityWeights),
  });
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60_000);
}

function addSeconds(date, seconds) {
  return new Date(date.getTime() + seconds * 1_000);
}

function selectCandidates(templates, config, rollInteger) {
  if (templates.length < config.candidateCount) {
    throw new DropError(
      "DROP_CATALOG_TOO_SMALL",
      `At least ${config.candidateCount} packable Card Templates are required.`,
      { required: config.candidateCount, available: templates.length },
    );
  }

  const templatesByTier = new Map();

  for (const template of templates) {
    const tierTemplates = templatesByTier.get(template.rarityTier) ?? [];
    tierTemplates.push(template);
    templatesByTier.set(template.rarityTier, tierTemplates);
  }

  const candidates = [];

  for (let position = 1; position <= config.candidateCount; position += 1) {
    const availableWeights = config.rarityWeights.filter(
      ({ rarityTier }) => (templatesByTier.get(rarityTier)?.length ?? 0) > 0,
    );
    const totalWeight = availableWeights.reduce(
      (sum, { weight }) => sum + weight,
      0,
    );
    const rarityRoll = rollInteger(0, totalWeight);
    let cumulativeWeight = 0;
    let selectedRarity = availableWeights.at(-1).rarityTier;

    for (const { rarityTier, weight } of availableWeights) {
      cumulativeWeight += weight;
      if (rarityRoll < cumulativeWeight) {
        selectedRarity = rarityTier;
        break;
      }
    }

    const tierTemplates = templatesByTier.get(selectedRarity);
    const templateIndex = rollInteger(0, tierTemplates.length);
    const [template] = tierTemplates.splice(templateIndex, 1);
    candidates.push(
      Object.freeze({
        candidatePosition: position,
        cardTemplateId: template.cardTemplateId,
        rolledRarityTier: selectedRarity,
        template,
      }),
    );
  }

  return Object.freeze(candidates);
}

async function useTransaction(databasePool, database, operation) {
  if (database) {
    return operation(database);
  }

  return withTransaction(databasePool, operation);
}

export function createDropService({
  databasePool,
  cardInstanceService,
  cardTemplateService,
  dropConfig,
  rollInteger = randomInt,
}) {
  const config = validateConfig(dropConfig);

  async function hydrateSession(database, session, { replayed = false } = {}) {
    const storedCandidates = await dropSessionRepository.findCandidates(
      database,
      session.dropSessionId,
    );
    const candidates = [];

    for (const candidate of storedCandidates) {
      candidates.push(
        Object.freeze({
          ...candidate,
          template: await cardTemplateService.getTemplate(
            candidate.cardTemplateId,
            { database },
          ),
        }),
      );
    }
    const resultInstance = session.resultCardInstanceId
      ? await cardInstanceService.getInstance(session.resultCardInstanceId, {
          database,
        })
      : null;

    return Object.freeze({
      session,
      candidates: Object.freeze(candidates),
      resultInstance,
      replayed,
    });
  }

  return Object.freeze({
    getOdds() {
      return Object.freeze({
        source: "drop",
        displayName: "Free Drop",
        candidateCount: config.candidateCount,
        odds: buildRarityOdds(config.rarityWeights),
      });
    },

    async getCooldown(
      playerId,
      { database = databasePool } = {},
    ) {
      const normalizedPlayerId = normalizeId(playerId, "playerId");
      const currentTime = await cooldownRepository.getDatabaseTime(database);
      const cooldown = await cooldownRepository.find(database, {
        playerId: normalizedPlayerId,
        cooldownType: FREE_DROP_COOLDOWN_TYPE,
      });

      return Object.freeze({
        cooldownType: FREE_DROP_COOLDOWN_TYPE,
        available: !cooldown || cooldown.availableAt <= currentTime,
        availableAt: cooldown?.availableAt ?? null,
        checkedAt: currentTime,
      });
    },

    async createOffer(
      { playerId, interactionId },
      { database } = {},
    ) {
      const normalizedPlayerId = normalizeId(playerId, "playerId");
      const normalizedInteractionId = normalizeInteractionId(interactionId);

      return useTransaction(databasePool, database, async (transactionDatabase) => {
        const currentTime =
          await cooldownRepository.getDatabaseTime(transactionDatabase);
        const cooldown = await cooldownRepository.getOrCreateForUpdate(
          transactionDatabase,
          {
            playerId: normalizedPlayerId,
            cooldownType: FREE_DROP_COOLDOWN_TYPE,
          },
        );
        const interactionSession =
          await dropSessionRepository.findByInteractionId(
            transactionDatabase,
            normalizedInteractionId,
          );

        if (interactionSession) {
          return hydrateSession(transactionDatabase, interactionSession, {
            replayed: true,
          });
        }

        const openSession = await dropSessionRepository.findOpenForUpdate(
          transactionDatabase,
          { playerId: normalizedPlayerId, dropType: FREE_DROP_TYPE },
        );

        if (openSession) {
          return hydrateSession(transactionDatabase, openSession, {
            replayed: true,
          });
        }

        if (cooldown.availableAt > currentTime) {
          throw new DropError(
            "FREE_DROP_COOLDOWN_ACTIVE",
            "The Free Drop cooldown is still active.",
            { availableAt: cooldown.availableAt },
          );
        }

        const templates = await cardTemplateService.listPackableTemplates({
          database: transactionDatabase,
        });
        const candidates = selectCandidates(templates, config, rollInteger);
        const session = await dropSessionRepository.create(
          transactionDatabase,
          {
            playerId: normalizedPlayerId,
            dropType: FREE_DROP_TYPE,
            interactionId: normalizedInteractionId,
            selectionExpiresAt: addSeconds(currentTime, config.selectionSeconds),
          },
        );
        await dropSessionRepository.createCandidates(
          transactionDatabase,
          session.dropSessionId,
          candidates,
        );

        return Object.freeze({
          session,
          candidates,
          resultInstance: null,
          replayed: false,
        });
      });
    },

    async confirmSelection(
      { playerId, dropSessionId, candidatePosition },
      { database } = {},
    ) {
      const normalizedPlayerId = normalizeId(playerId, "playerId");
      const normalizedDropSessionId = normalizeId(
        dropSessionId,
        "dropSessionId",
      );
      const requestedPosition = normalizeCandidatePosition(
        candidatePosition,
        config.candidateCount,
      );

      return useTransaction(databasePool, database, async (transactionDatabase) => {
        const cooldown = await cooldownRepository.getOrCreateForUpdate(
          transactionDatabase,
          {
            playerId: normalizedPlayerId,
            cooldownType: FREE_DROP_COOLDOWN_TYPE,
          },
        );
        const session = await dropSessionRepository.findByIdForUpdate(
          transactionDatabase,
          normalizedDropSessionId,
        );

        if (!session || session.playerId !== normalizedPlayerId) {
          throw new DropError(
            "DROP_SESSION_NOT_FOUND",
            "This Drop session does not belong to the Player.",
          );
        }

        const currentTime =
          await cooldownRepository.getDatabaseTime(transactionDatabase);
        const normalizedPosition =
          session.status === "OPEN" && session.selectionExpiresAt <= currentTime
            ? 1
            : requestedPosition;

        const candidates = await dropSessionRepository.findCandidates(
          transactionDatabase,
          session.dropSessionId,
        );
        const selectedCandidate = candidates.find(
          (candidate) => candidate.candidatePosition === normalizedPosition,
        );

        if (!selectedCandidate) {
          throw new DropError(
            "DROP_CANDIDATE_NOT_FOUND",
            "The selected Card Template is not part of this Drop session.",
          );
        }

        if (session.status === "COMPLETED") {
          if (session.selectedTemplateId !== selectedCandidate.cardTemplateId) {
            throw new DropError(
              "DROP_ALREADY_COMPLETED",
              "A different card was already selected from this Drop.",
            );
          }

          return hydrateSession(transactionDatabase, session, { replayed: true });
        }

        const cardLevel = rollInteger(1, 6);
        const mint = await cardInstanceService.mintCard(
          {
            cardTemplateId: selectedCandidate.cardTemplateId,
            ownerPlayerId: normalizedPlayerId,
            cardLevel,
            obtainedMethod: "DROP",
            referenceType: "DROP_SESSION",
            referenceId: session.dropSessionId,
          },
          { database: transactionDatabase },
        );
        const completedSession = await dropSessionRepository.complete(
          transactionDatabase,
          {
            dropSessionId: session.dropSessionId,
            selectedTemplateId: selectedCandidate.cardTemplateId,
            resultCardInstanceId: mint.instance.cardInstanceId,
          },
        );
        const updatedCooldown = await cooldownRepository.setAvailableAt(
          transactionDatabase,
          {
            playerId: normalizedPlayerId,
            cooldownType: FREE_DROP_COOLDOWN_TYPE,
            availableAt: addMinutes(currentTime, config.cooldownMinutes),
          },
        );
        const hydrated = await hydrateSession(
          transactionDatabase,
          completedSession,
        );

        return Object.freeze({ ...hydrated, cooldown: updatedCooldown });
      });
    },

    async completeExpiredOffers() {
      const sessions = await dropSessionRepository.findExpiredOpen(databasePool);
      const completed = [];
      for (const session of sessions) {
        try {
          completed.push(
            await this.confirmSelection({
              playerId: session.playerId,
              dropSessionId: session.dropSessionId,
              candidatePosition: 1,
            }),
          );
        } catch (error) {
          if (!(error instanceof DropError)) {
            throw error;
          }
        }
      }
      return Object.freeze(completed);
    },
  });
}
