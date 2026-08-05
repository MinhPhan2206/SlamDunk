import { collectionRepository } from "./collection.repository.js";
import {
  DEFAULT_COLLECTION_SORT,
  getCollectionSortDefinition,
} from "./collection-sort.js";
import { CardError } from "../card/index.js";

const PAGE_SIZE = 10;

function normalizeId(value) {
  const normalized = String(value);

  if (!/^\d+$/.test(normalized) || BigInt(normalized) <= 0n) {
    throw new TypeError("playerId must be a positive integer.");
  }

  return normalized;
}

function normalizePage(value) {
  if (!Number.isSafeInteger(value) || value < 1 || value > 1_000_000) {
    throw new TypeError("page must be a positive safe integer.");
  }

  return value;
}

function normalizeCardReference(value) {
  const normalized = String(value).trim().replace(/^!/, "");
  if (!/^\d+$/.test(normalized) || BigInt(normalized) <= 0n) {
    throw new TypeError("cardReference must be a positive integer.");
  }
  return normalized;
}

export function createCollectionService({ databasePool }) {
  async function getPlayerSort(playerId, database) {
    return (
      (await collectionRepository.getSortKey(database, playerId)) ??
      DEFAULT_COLLECTION_SORT
    );
  }

  return Object.freeze({
    async setSort(
      { playerId, sortBy = "RARITY" },
      { database = databasePool } = {},
    ) {
      const normalizedPlayerId = normalizeId(playerId);
      const definition = getCollectionSortDefinition(sortBy);
      const preference = await collectionRepository.setSortKey(database, {
        playerId: normalizedPlayerId,
        sortKey: definition.key,
      });
      return Object.freeze({ ...preference, label: definition.label });
    },

    async resolveOwnedCardReference(
      { playerId, cardReference },
      { database = databasePool } = {},
    ) {
      const normalizedPlayerId = normalizeId(playerId);
      const normalizedReference = normalizeCardReference(cardReference);
      const sortKey = await getPlayerSort(normalizedPlayerId, database);
      const cardInstanceId = await collectionRepository.resolveOwnedReference(
        database,
        {
          playerId: normalizedPlayerId,
          cardReference: normalizedReference,
          sortKey,
        },
      );
      if (!cardInstanceId) {
        throw new CardError(
          "CARD_REFERENCE_NOT_FOUND",
          "No active owned card matches that public ID or collection number.",
        );
      }
      return cardInstanceId;
    },

    async listOwnedCards(
      { playerId, page = 1 },
      { database = databasePool } = {},
    ) {
      const normalizedPage = normalizePage(page);
      const normalizedPlayerId = normalizeId(playerId);
      const sortKey = await getPlayerSort(normalizedPlayerId, database);
      const result = await collectionRepository.listOwnedCards(database, {
        playerId: normalizedPlayerId,
        sortKey,
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
        sortKey,
        sortLabel: getCollectionSortDefinition(sortKey).label,
      });
    },
  });
}
