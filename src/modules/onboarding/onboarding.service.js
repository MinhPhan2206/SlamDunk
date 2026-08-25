import { randomInt } from "node:crypto";

import { withTransaction } from "../../database/transaction/transaction-manager.js";
import { onboardingRepository } from "./onboarding.repository.js";

const STARTER_SLOTS = Object.freeze(["PG", "SG", "SF", "PF", "C"]);

function normalizePlayerId(playerId) {
  const value = String(playerId);
  if (!/^\d+$/.test(value) || BigInt(value) <= 0n) {
    throw new TypeError("playerId must be a positive integer.");
  }
  return value;
}

function shuffled(values, randomIndex) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function assignStarterTemplates(templates, randomIndex) {
  const baseTemplates = templates.filter((template) =>
    template.rarityCode === "BASE");
  const candidatesBySlot = new Map(STARTER_SLOTS.map((slot) => [
    slot,
    shuffled(baseTemplates.filter((template) =>
      template.primaryPosition === slot || template.secondaryPosition === slot), randomIndex),
  ]));
  const orderedSlots = [...STARTER_SLOTS].sort((left, right) =>
    candidatesBySlot.get(left).length - candidatesBySlot.get(right).length);
  const selected = new Map();
  const usedTemplateIds = new Set();

  function select(index) {
    if (index === orderedSlots.length) return true;
    const slot = orderedSlots[index];
    for (const template of candidatesBySlot.get(slot)) {
      if (usedTemplateIds.has(template.cardTemplateId)) continue;
      selected.set(slot, template);
      usedTemplateIds.add(template.cardTemplateId);
      if (select(index + 1)) return true;
      selected.delete(slot);
      usedTemplateIds.delete(template.cardTemplateId);
    }
    return false;
  }

  if (!select(0)) {
    throw new Error("The Base Card catalog cannot form a complete PG/SG/SF/PF/C starter lineup.");
  }
  return STARTER_SLOTS.map((slot) => Object.freeze({ slot, template: selected.get(slot) }));
}

export function createOnboardingService({
  databasePool,
  cardTemplateService,
  cardInstanceService,
  lineupService,
  securityService,
  randomIndex = (maximum) => randomInt(maximum),
}) {
  return Object.freeze({
    async grantStarterLineup({ playerId, interactionId }, { database } = {}) {
      const normalizedPlayerId = normalizePlayerId(playerId);
      if (typeof interactionId !== "string" || !interactionId.trim()) {
        throw new TypeError("interactionId must be a non-empty string.");
      }

      const operation = async (transactionDatabase) => {
        const player = await onboardingRepository.lockPlayer(transactionDatabase, normalizedPlayerId);
        if (!player) throw new Error("Player was not found for onboarding.");
        if (player.starterLineupGrantedAt) {
          return Object.freeze({ alreadyGranted: true, cards: Object.freeze([]) });
        }
        await securityService?.assertCanEarn(
          { playerId: normalizedPlayerId },
          { database: transactionDatabase },
        );

        const templates = await cardTemplateService.listPackableTemplates({ database: transactionDatabase });
        const assignments = assignStarterTemplates(templates, randomIndex);
        const currentLineup = await lineupService.getLineup(normalizedPlayerId, { database: transactionDatabase });
        const occupiedSlots = new Set(currentLineup.slots
          .filter((slot) => slot.cardInstanceId)
          .map((slot) => slot.slot));
        const cards = [];

        for (const { slot, template } of assignments) {
          const minted = await cardInstanceService.mintCard({
            cardTemplateId: template.cardTemplateId,
            ownerPlayerId: normalizedPlayerId,
            cardLevel: 1,
            obtainedMethod: "ADMIN_GRANT",
            accountBound: true,
            referenceType: "WELCOME",
            referenceId: interactionId.trim(),
          }, { database: transactionDatabase });
          if (!occupiedSlots.has(slot)) {
            await lineupService.setCard({
              playerId: normalizedPlayerId,
              slot,
              cardInstanceId: minted.instance.cardInstanceId,
            }, { database: transactionDatabase });
          }
          cards.push(Object.freeze({
            slot,
            playerName: template.playerName,
            rarityName: template.rarityName,
            cardLevel: minted.instance.cardLevel,
            publicCardId: minted.instance.publicCardId,
          }));
        }

        await onboardingRepository.markStarterLineupGranted(transactionDatabase, normalizedPlayerId);
        return Object.freeze({ alreadyGranted: false, cards: Object.freeze(cards) });
      };
      return database ? operation(database) : withTransaction(databasePool, operation);
    },
  });
}
