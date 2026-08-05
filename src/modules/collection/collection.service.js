import { collectionRepository } from "./collection.repository.js";

const PAGE_SIZE = 10;

function normalizeId(value) {
  const normalized = String(value);

  if (!/^\d+$/.test(normalized) || BigInt(normalized) <= 0n) {
    throw new TypeError("playerId must be a positive integer.");
  }

  return normalized;
}

function normalizeRarityCode(value) {
  if (value == null) {
    return null;
  }

  if (typeof value !== "string" || !/^[A-Z][A-Z0-9_]*$/.test(value)) {
    throw new TypeError("rarityCode must be a valid rarity code.");
  }

  return value;
}

function normalizePage(value) {
  if (!Number.isSafeInteger(value) || value < 1 || value > 1_000_000) {
    throw new TypeError("page must be a positive safe integer.");
  }

  return value;
}

export function createCollectionService({ databasePool }) {
  return Object.freeze({
    async listOwnedCards(
      { playerId, rarityCode = null, page = 1 },
      { database = databasePool } = {},
    ) {
      const normalizedPage = normalizePage(page);
      const result = await collectionRepository.listOwnedCards(database, {
        playerId: normalizeId(playerId),
        rarityCode: normalizeRarityCode(rarityCode),
        limit: PAGE_SIZE,
        offset: (normalizedPage - 1) * PAGE_SIZE,
      });
      const totalPages = Number(
        (BigInt(result.total) + BigInt(PAGE_SIZE) - 1n) / BigInt(PAGE_SIZE),
      );

      return Object.freeze({
        cards: result.cards,
        total: result.total,
        page: normalizedPage,
        pageSize: PAGE_SIZE,
        totalPages,
        rarityCode: normalizeRarityCode(rarityCode),
      });
    },
  });
}
