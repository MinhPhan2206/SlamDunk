import { randomInt } from "node:crypto";

import { withTransaction } from "../../database/transaction/transaction-manager.js";
import { cooldownRepository } from "../reward/cooldown.repository.js";
import { PackError } from "./pack.errors.js";
import { packSessionRepository } from "./pack-session.repository.js";

const FREE_DROP_TYPE = "FREE_DROP";
const FREE_PACK_COOLDOWN_TYPE = "FREE_PACK";

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
    !Number.isSafeInteger(config?.cooldownMinutes) ||
    config.cooldownMinutes <= 0
  ) {
    throw new TypeError("freeDropConfig.cooldownMinutes must be positive.");
  }

  if (
    !Number.isSafeInteger(config?.candidateCount) ||
    config.candidateCount < 2 ||
    config.candidateCount > 10
  ) {
    throw new TypeError(
      "freeDropConfig.candidateCount must be an integer from 2 through 10.",
    );
  }

  if (!Array.isArray(config.rarityWeights) || config.rarityWeights.length !== 7) {
    throw new TypeError("freeDropConfig.rarityWeights must define 7 tiers.");
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
    rarityWeights: Object.freeze(rarityWeights),
  });
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60_000);
}

function selectCandidates(templates, config, rollInteger) {
  if (templates.length < config.candidateCount) {
    throw new PackError(
      "PACK_CATALOG_TOO_SMALL",
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

export function createPackService({
  databasePool,
  cardInstanceService,
  cardTemplateService,
  freeDropConfig,
  rollInteger = randomInt,
}) {
  const config = validateConfig(freeDropConfig);

  async function hydrateSession(database, session, { replayed = false } = {}) {
    const storedCandidates = await packSessionRepository.findCandidates(
      database,
      session.packSessionId,
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
    async getFreeDropCooldown(
      playerId,
      { database = databasePool } = {},
    ) {
      const normalizedPlayerId = normalizeId(playerId, "playerId");
      const currentTime = await cooldownRepository.getDatabaseTime(database);
      const cooldown = await cooldownRepository.find(database, {
        playerId: normalizedPlayerId,
        cooldownType: FREE_PACK_COOLDOWN_TYPE,
      });

      return Object.freeze({
        cooldownType: FREE_PACK_COOLDOWN_TYPE,
        available: !cooldown || cooldown.availableAt <= currentTime,
        availableAt: cooldown?.availableAt ?? null,
        checkedAt: currentTime,
      });
    },

    async createFreeDropOffer(
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
            cooldownType: FREE_PACK_COOLDOWN_TYPE,
          },
        );
        const interactionSession =
          await packSessionRepository.findByInteractionId(
            transactionDatabase,
            normalizedInteractionId,
          );

        if (interactionSession) {
          return hydrateSession(transactionDatabase, interactionSession, {
            replayed: true,
          });
        }

        const openSession = await packSessionRepository.findOpenForUpdate(
          transactionDatabase,
          { playerId: normalizedPlayerId, packType: FREE_DROP_TYPE },
        );

        if (openSession) {
          return hydrateSession(transactionDatabase, openSession, {
            replayed: true,
          });
        }

        if (cooldown.availableAt > currentTime) {
          throw new PackError(
            "FREE_DROP_COOLDOWN_ACTIVE",
            "The Free Drop cooldown is still active.",
            { availableAt: cooldown.availableAt },
          );
        }

        const templates = await cardTemplateService.listPackableTemplates({
          database: transactionDatabase,
        });
        const candidates = selectCandidates(templates, config, rollInteger);
        const session = await packSessionRepository.create(
          transactionDatabase,
          {
            playerId: normalizedPlayerId,
            packType: FREE_DROP_TYPE,
            interactionId: normalizedInteractionId,
          },
        );
        await packSessionRepository.createCandidates(
          transactionDatabase,
          session.packSessionId,
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

    async confirmFreeDropSelection(
      { playerId, packSessionId, candidatePosition },
      { database } = {},
    ) {
      const normalizedPlayerId = normalizeId(playerId, "playerId");
      const normalizedPackSessionId = normalizeId(
        packSessionId,
        "packSessionId",
      );
      const normalizedPosition = normalizeCandidatePosition(
        candidatePosition,
        config.candidateCount,
      );

      return useTransaction(databasePool, database, async (transactionDatabase) => {
        const cooldown = await cooldownRepository.getOrCreateForUpdate(
          transactionDatabase,
          {
            playerId: normalizedPlayerId,
            cooldownType: FREE_PACK_COOLDOWN_TYPE,
          },
        );
        const session = await packSessionRepository.findByIdForUpdate(
          transactionDatabase,
          normalizedPackSessionId,
        );

        if (!session || session.playerId !== normalizedPlayerId) {
          throw new PackError(
            "PACK_SESSION_NOT_FOUND",
            "This Pack session does not belong to the Player.",
          );
        }

        const candidates = await packSessionRepository.findCandidates(
          transactionDatabase,
          session.packSessionId,
        );
        const selectedCandidate = candidates.find(
          (candidate) => candidate.candidatePosition === normalizedPosition,
        );

        if (!selectedCandidate) {
          throw new PackError(
            "PACK_CANDIDATE_NOT_FOUND",
            "The selected Card Template is not part of this Pack session.",
          );
        }

        if (session.status === "COMPLETED") {
          if (session.selectedTemplateId !== selectedCandidate.cardTemplateId) {
            throw new PackError(
              "PACK_ALREADY_COMPLETED",
              "A different card was already selected from this Pack.",
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
            obtainedMethod: "PACK",
            referenceType: "PACK_SESSION",
            referenceId: session.packSessionId,
          },
          { database: transactionDatabase },
        );
        const completedSession = await packSessionRepository.complete(
          transactionDatabase,
          {
            packSessionId: session.packSessionId,
            selectedTemplateId: selectedCandidate.cardTemplateId,
            resultCardInstanceId: mint.instance.cardInstanceId,
          },
        );
        const currentTime =
          await cooldownRepository.getDatabaseTime(transactionDatabase);
        const updatedCooldown = await cooldownRepository.setAvailableAt(
          transactionDatabase,
          {
            playerId: normalizedPlayerId,
            cooldownType: FREE_PACK_COOLDOWN_TYPE,
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
  });
}
