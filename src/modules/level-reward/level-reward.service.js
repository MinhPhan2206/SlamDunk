import { randomInt } from "node:crypto";

import { withTransaction } from "../../database/transaction/transaction-manager.js";
import { getRarityDefinition } from "../../config/rarity-config.js";
import { EconomyCurrency } from "../economy/index.js";
import { LevelRewardError } from "./level-reward.errors.js";
import { levelRewardRepository } from "./level-reward.repository.js";

const REFERENCE_TYPE = "PLAYER_LEVEL_REWARD";

function positiveInteger(value, fieldName, { optional = false } = {}) {
  if (optional && value == null) return 0;
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${fieldName} must be a positive integer.`);
  }
  return value;
}

function normalizePlayerId(value) {
  const normalized = String(value ?? "");
  if (!/^\d+$/.test(normalized) || BigInt(normalized) <= 0n) {
    throw new TypeError("playerId must be a positive integer.");
  }
  return normalized;
}

function normalizeMilestones(config) {
  if (!Array.isArray(config?.milestones) || config.milestones.length === 0) {
    throw new TypeError("levelRewardConfig.milestones must not be empty.");
  }
  const levels = new Set();
  const milestones = config.milestones.map((milestone, index) => {
    const level = positiveInteger(milestone?.level, `milestones[${index}].level`);
    if (levels.has(level)) throw new TypeError("Milestone Levels must be unique.");
    levels.add(level);
    const cards = (milestone.cards ?? []).map((card, cardIndex) => Object.freeze({
      rarityCode: getRarityDefinition(String(card.rarityCode).toUpperCase()).rarityCode,
      quantity: positiveInteger(card.quantity, `milestones[${index}].cards[${cardIndex}].quantity`),
      cardLevel: positiveInteger(card.cardLevel, `milestones[${index}].cards[${cardIndex}].cardLevel`),
    }));
    if (cards.some(({ cardLevel }) => cardLevel > 5)) {
      throw new TypeError("Milestone Card Levels must be from 1 through 5.");
    }
    const items = (milestone.items ?? []).map((item, itemIndex) => {
      const itemType = String(item.itemType ?? "").trim().toUpperCase();
      const itemName = String(item.itemName ?? "").trim();
      if (!itemType || !itemName) {
        throw new TypeError(`milestones[${index}].items[${itemIndex}] requires itemType and itemName.`);
      }
      return Object.freeze({
        itemType,
        itemName,
        quantity: positiveInteger(
          item.quantity,
          `milestones[${index}].items[${itemIndex}].quantity`,
        ),
      });
    });
    const normalized = Object.freeze({
      level,
      gold: positiveInteger(milestone.gold, `milestones[${index}].gold`, { optional: true }),
      shards: positiveInteger(milestone.shards, `milestones[${index}].shards`, { optional: true }),
      items: Object.freeze(items),
      cards: Object.freeze(cards),
    });
    if (!normalized.gold && !normalized.shards && !items.length && !cards.length) {
      throw new TypeError(`Milestone Level ${level} has no rewards.`);
    }
    return normalized;
  });
  return Object.freeze(milestones.sort((left, right) => left.level - right.level));
}

function chooseTemplate(templates, rarityCode, rollInteger) {
  const candidates = templates.filter((template) => template.rarityCode === rarityCode);
  if (candidates.length === 0) {
    throw new LevelRewardError(
      "CARD_TEMPLATE_UNAVAILABLE",
      `No active ${getRarityDefinition(rarityCode).name} Card is available.`,
    );
  }
  return candidates[rollInteger(0, candidates.length)];
}

function milestoneView(milestone, claimedLevels, playerLevel) {
  return Object.freeze({
    ...milestone,
    claimed: claimedLevels.has(milestone.level),
    eligible: playerLevel >= milestone.level,
  });
}

export function createLevelRewardService({
  databasePool,
  economyService,
  inventoryService,
  cardTemplateService,
  cardInstanceService,
  levelRewardConfig,
  rollInteger = randomInt,
}) {
  const milestones = normalizeMilestones(levelRewardConfig);

  return Object.freeze({
    async claimAvailable({ playerId }, { database } = {}) {
      const normalizedPlayerId = normalizePlayerId(playerId);
      const operation = async (transactionDatabase) => {
        const player = await levelRewardRepository.findPlayerForUpdate(
          transactionDatabase,
          normalizedPlayerId,
        );
        if (!player) throw new LevelRewardError("PLAYER_NOT_FOUND", "Player was not found.");

        const existingClaims = await levelRewardRepository.findClaims(
          transactionDatabase,
          normalizedPlayerId,
        );
        const claimedLevels = new Set(existingClaims.map(({ milestoneLevel }) => milestoneLevel));
        const available = milestones.filter(
          ({ level }) => level <= player.playerLevel && !claimedLevels.has(level),
        );
        const needsCards = available.some(({ cards }) => cards.length > 0);
        const templates = needsCards
          ? await cardTemplateService.listPackableTemplates({ database: transactionDatabase })
          : [];
        const newClaims = [];

        for (const milestone of available) {
          const referenceId = `${normalizedPlayerId}:${milestone.level}`;
          const snapshot = {
            gold: milestone.gold,
            shards: milestone.shards,
            items: [],
            cards: [],
          };
          if (milestone.gold) {
            await economyService.credit({
              playerId: normalizedPlayerId,
              currency: EconomyCurrency.GOLD,
              amount: milestone.gold,
              transactionType: "PLAYER_LEVEL_REWARD",
              referenceType: REFERENCE_TYPE,
              referenceId,
              idempotencyKey: `player-level:${referenceId}:gold`,
            }, { database: transactionDatabase });
          }
          if (milestone.shards) {
            await economyService.credit({
              playerId: normalizedPlayerId,
              currency: EconomyCurrency.SHARDS,
              amount: milestone.shards,
              transactionType: "PLAYER_LEVEL_REWARD",
              referenceType: REFERENCE_TYPE,
              referenceId,
              idempotencyKey: `player-level:${referenceId}:shards`,
            }, { database: transactionDatabase });
          }
          for (const item of milestone.items) {
            await inventoryService.grantItem({
              playerId: normalizedPlayerId,
              itemType: item.itemType,
              quantity: item.quantity,
            }, { database: transactionDatabase });
            snapshot.items.push(item);
          }
          let rewardCardIndex = 0;
          for (const cardReward of milestone.cards) {
            for (let quantity = 0; quantity < cardReward.quantity; quantity += 1) {
              rewardCardIndex += 1;
              const template = chooseTemplate(templates, cardReward.rarityCode, rollInteger);
              const minted = await cardInstanceService.mintCard({
                cardTemplateId: template.cardTemplateId,
                ownerPlayerId: normalizedPlayerId,
                cardLevel: cardReward.cardLevel,
                obtainedMethod: "EVENT_REWARD",
                accountBound: true,
                referenceType: REFERENCE_TYPE,
                referenceId: `${referenceId}:${rewardCardIndex}`,
              }, { database: transactionDatabase });
              snapshot.cards.push({
                playerName: template.playerName,
                rarityCode: template.rarityCode,
                cardLevel: cardReward.cardLevel,
                publicCardId: minted.instance.publicCardId,
              });
            }
          }
          const claim = await levelRewardRepository.createClaim(transactionDatabase, {
            playerId: normalizedPlayerId,
            milestoneLevel: milestone.level,
            rewardSnapshot: snapshot,
          });
          claimedLevels.add(milestone.level);
          newClaims.push(claim);
        }

        return Object.freeze({
          playerLevel: player.playerLevel,
          newClaims: Object.freeze(newClaims),
          milestones: Object.freeze(milestones.map((milestone) =>
            milestoneView(milestone, claimedLevels, player.playerLevel))),
        });
      };
      return database
        ? operation(database)
        : withTransaction(databasePool, operation);
    },
  });
}
