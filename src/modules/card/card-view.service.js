import { getActualCardStats } from "./card-stats.js";
import { CardError } from "./card.errors.js";
import { cardViewRepository } from "./card-view.repository.js";

function normalizeId(value, fieldName) {
  const normalized = String(value);
  if (!/^\d+$/.test(normalized) || BigInt(normalized) <= 0n) {
    throw new TypeError(`${fieldName} must be a positive integer.`);
  }
  return normalized;
}

function average(total, games) {
  return games === 0 ? 0 : total / games;
}

function percentage(made, attempted) {
  return attempted === 0 ? 0 : (made / attempted) * 100;
}

function withActualStats(card) {
  return Object.freeze({
    ...card,
    actualStats: getActualCardStats(card, card.cardLevel),
  });
}

export function createCardViewService({ databasePool, traitService }) {
  return Object.freeze({
    async getInstance(cardInstanceId, { database = databasePool } = {}) {
      const card = await cardViewRepository.findInstanceById(
        database,
        normalizeId(cardInstanceId, "cardInstanceId"),
      );
      if (!card) {
        throw new CardError("CARD_INSTANCE_NOT_FOUND", "Card Instance was not found.");
      }
      return withActualStats(card);
    },

    async getInstanceByPublicId(publicCardId, { database = databasePool } = {}) {
      const card = await cardViewRepository.findInstanceByPublicId(
        database,
        normalizeId(String(publicCardId).replace(/^!/, ""), "publicCardId"),
      );
      if (!card) {
        throw new CardError("CARD_INSTANCE_NOT_FOUND", "Card Instance was not found.");
      }
      return withActualStats(card);
    },

    async getTemplate(cardTemplateId, { database = databasePool } = {}) {
      const template = await cardViewRepository.findTemplateById(
        database,
        normalizeId(cardTemplateId, "cardTemplateId"),
      );
      if (!template) {
        throw new CardError("CARD_TEMPLATE_NOT_FOUND", "Card Template was not found.");
      }
      return template;
    },

    async findTemplatesByName(playerName, { database = databasePool } = {}) {
      const normalized = String(playerName).trim();
      if (!normalized) return Object.freeze([]);
      return Object.freeze(
        await cardViewRepository.findTemplatesByExactName(database, normalized),
      );
    },

    async searchTemplates(query, { database = databasePool, limit = 25 } = {}) {
      const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 25);
      return Object.freeze(await cardViewRepository.searchTemplates(
        database,
        String(query ?? "").trim().slice(0, 100),
        safeLimit,
      ));
    },

    async getTraits(cardTemplateId, options = {}) {
      return traitService.getTraitsForTemplate(cardTemplateId, options);
    },

    async getBattleStats(cardInstanceId, { database = databasePool } = {}) {
      const totals = await cardViewRepository.getBattleTotals(
        database,
        normalizeId(cardInstanceId, "cardInstanceId"),
      );
      const gamesPlayed = Number(totals.games_played);
      return Object.freeze({
        gamesPlayed,
        pointsPerGame: average(Number(totals.points), gamesPlayed),
        reboundsPerGame: average(Number(totals.rebounds), gamesPlayed),
        assistsPerGame: average(Number(totals.assists), gamesPlayed),
        stealsPerGame: average(Number(totals.steals), gamesPlayed),
        blocksPerGame: average(Number(totals.blocks), gamesPlayed),
        turnoversPerGame: average(Number(totals.turnovers), gamesPlayed),
        fieldGoalPercentage: percentage(
          Number(totals.field_goals_made),
          Number(totals.field_goals_attempted),
        ),
        threePointPercentage: percentage(
          Number(totals.three_pointers_made),
          Number(totals.three_pointers_attempted),
        ),
      });
    },
  });
}
