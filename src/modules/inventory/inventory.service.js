import { inventoryRepository } from "./inventory.repository.js";

function normalizePlayerId(value) {
  const normalized = String(value);
  if (!/^\d+$/.test(normalized) || BigInt(normalized) <= 0n) {
    throw new TypeError("playerId must be a positive integer.");
  }
  return normalized;
}

function humanizeItemType(itemType) {
  return itemType
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

function normalizeDefinitions(itemDefinitions) {
  return itemDefinitions.map((definition) => Object.freeze({
    itemType: String(definition.itemType).trim().toUpperCase(),
    itemName: String(definition.itemName).trim(),
  }));
}

export function createInventoryService({ databasePool, itemDefinitions = [] }) {
  const definitions = normalizeDefinitions(itemDefinitions);
  return Object.freeze({
    async grantItem(
      { playerId, itemType, quantity },
      { database = databasePool } = {},
    ) {
      const normalizedType = String(itemType).trim().toUpperCase();
      if (!normalizedType || !Number.isSafeInteger(quantity) || quantity <= 0) {
        throw new TypeError("A valid itemType and positive quantity are required.");
      }
      return inventoryRepository.grantItem(database, {
        playerId: normalizePlayerId(playerId),
        itemType: normalizedType,
        quantity,
      });
    },

    async listItems(playerId, { database = databasePool } = {}) {
      const storedItems = await inventoryRepository.listPlayerItems(
        database,
        normalizePlayerId(playerId),
      );
      const storedByType = new Map(
        storedItems.map((item) => [item.itemType, item.quantity]),
      );
      const items = definitions.map((definition) => Object.freeze({
        ...definition,
        quantity: storedByType.get(definition.itemType) ?? 0,
      }));
      const knownTypes = new Set(definitions.map(({ itemType }) => itemType));
      for (const item of storedItems) {
        if (!knownTypes.has(item.itemType)) {
          items.push(Object.freeze({
            ...item,
            itemName: humanizeItemType(item.itemType),
          }));
        }
      }
      return Object.freeze(items);
    },

    async consumeItem(
      { playerId, itemType, quantity = 1 },
      { database = databasePool } = {},
    ) {
      const normalizedType = String(itemType).trim().toUpperCase();
      if (!normalizedType || !Number.isSafeInteger(quantity) || quantity <= 0) {
        throw new TypeError("A valid itemType and positive quantity are required.");
      }
      return inventoryRepository.consumeItem(database, {
        playerId: normalizePlayerId(playerId),
        itemType: normalizedType,
        quantity,
      });
    },
  });
}
