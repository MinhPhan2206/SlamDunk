import { randomInt } from "node:crypto";

import { withTransaction } from "../../database/transaction/transaction-manager.js";
import {
  normalizeCardLevelWeights,
  rollCardLevel,
} from "../card/card-level-roll.js";
import { EconomyCurrency, EconomyError } from "../economy/index.js";
import { buildRarityOdds } from "../rarity/rarity-odds.js";
import { cooldownRepository } from "../reward/cooldown.repository.js";
import { PackError } from "./pack.errors.js";
import { packOpeningRepository } from "./pack-opening.repository.js";

function normalizeCatalog(packCatalog) {
  if (!Array.isArray(packCatalog) || packCatalog.length === 0) {
    throw new TypeError("packCatalog must contain at least one Pack definition.");
  }
  const packs = new Map();
  let defaultPackCode = null;
  for (const definition of packCatalog) {
    if (
      typeof definition.packCode !== "string" ||
      !/^[a-z][a-z0-9_-]*$/.test(definition.packCode) ||
      typeof definition.displayName !== "string" ||
      !Object.values(EconomyCurrency).includes(definition.priceCurrency) ||
      !Number.isSafeInteger(definition.priceAmount) || definition.priceAmount <= 0 ||
      !Number.isSafeInteger(definition.cooldownSeconds) || definition.cooldownSeconds <= 0 ||
      !Number.isSafeInteger(definition.cardCount) ||
      definition.cardCount < 1 || definition.cardCount > 5 ||
      packs.has(definition.packCode)
    ) {
      throw new TypeError("Each Pack requires valid, unique product configuration.");
    }
    const pack = Object.freeze({
      packCode: definition.packCode,
      displayName: definition.displayName.trim(),
      priceCurrency: definition.priceCurrency,
      priceAmount: definition.priceAmount,
      cooldownSeconds: definition.cooldownSeconds,
      cardCount: definition.cardCount,
      levelWeights: normalizeCardLevelWeights(definition.levelWeights),
      rarityWeights: definition.rarityWeights,
      odds: buildRarityOdds(definition.rarityWeights),
    });
    packs.set(pack.packCode, pack);
    if (definition.default) {
      if (defaultPackCode) throw new TypeError("Only one Pack can be the default.");
      defaultPackCode = pack.packCode;
    }
  }
  return Object.freeze({ packs, defaultPackCode: defaultPackCode ?? packs.keys().next().value });
}

function groupTemplatesByRarity(templates) {
  const byRarity = new Map();
  for (const template of templates) {
    const entries = byRarity.get(template.rarityCode) ?? [];
    entries.push(template);
    byRarity.set(template.rarityCode, entries);
  }
  return byRarity;
}

function pickTemplate(byRarity, pack, rollInteger) {
  const available = pack.rarityWeights.filter(({ rarityCode }) => byRarity.has(rarityCode));
  if (!available.length) throw new PackError("PACK_CATALOG_EMPTY", "No eligible cards are available for this Pack.");
  const total = available.reduce((sum, entry) => sum + entry.weight, 0);
  const roll = rollInteger(0, total);
  let cumulative = 0;
  let rarityCode = available.at(-1).rarityCode;
  for (const entry of available) {
    cumulative += entry.weight;
    if (roll < cumulative) { rarityCode = entry.rarityCode; break; }
  }
  const candidates = byRarity.get(rarityCode);
  return candidates[rollInteger(0, candidates.length)];
}

function addSeconds(date, seconds) {
  return new Date(date.getTime() + seconds * 1_000);
}

function normalizeQuantity(quantity) {
  const value = quantity ?? 1;
  if (!Number.isSafeInteger(value) || value < 1 || value > 100) {
    throw new PackError(
      "PACK_QUANTITY_INVALID",
      "Pack quantity must be between 1 and 100.",
    );
  }
  return value;
}

export function createPackService({
  packCatalog,
  databasePool,
  economyService,
  cardTemplateService,
  cardInstanceService,
  securityService,
  rollInteger = randomInt,
}) {
  const catalog = normalizeCatalog(packCatalog);
  let templatePoolsPromise;
  const getTemplatePools = (database) => {
    if (!templatePoolsPromise) {
      templatePoolsPromise = cardTemplateService
        .listPackableTemplates({ database })
        .then(groupTemplatesByRarity)
        .catch((error) => {
          templatePoolsPromise = undefined;
          throw error;
        });
    }
    return templatePoolsPromise;
  };
  const findPack = (packCode = catalog.defaultPackCode) => {
    const normalizedCode = String(packCode).trim().toLowerCase();
    const pack = catalog.packs.get(normalizedCode);
    if (!pack) throw new PackError("PACK_NOT_FOUND", `Pack '${normalizedCode}' is not configured.`);
    return pack;
  };

  async function hydrate(database, opening, replayed) {
    let openingCards = await packOpeningRepository.listCards(
      database,
      opening.packOpeningId,
    );
    if (!openingCards.length && opening.cardTemplateId && opening.cardInstanceId) {
      openingCards = [Object.freeze({
        cardPosition: 1,
        cardTemplateId: opening.cardTemplateId,
        cardInstanceId: opening.cardInstanceId,
      })];
    }
    const templateIds = [...new Set(openingCards.map((card) =>
      String(card.cardTemplateId)
    ))];
    const instanceIds = [...new Set(openingCards.map((card) =>
      String(card.cardInstanceId)
    ))];
    const templates = templateIds.length > 0
      ? await cardTemplateService.getTemplatesByIds(templateIds, { database })
      : [];
    const instances = instanceIds.length > 0
      ? await cardInstanceService.getInstancesByIds(instanceIds, { database })
      : [];
    const templatesById = new Map(templates.map((template) => [
      String(template.cardTemplateId),
      template,
    ]));
    const instancesById = new Map(instances.map((instance) => [
      String(instance.cardInstanceId),
      instance,
    ]));
    const cards = openingCards.map((openingCard) => Object.freeze({
      openingCard,
      template: templatesById.get(String(openingCard.cardTemplateId)),
      instance: instancesById.get(String(openingCard.cardInstanceId)),
    }));
    const firstCard = cards[0];
    return Object.freeze({
      source: "pack",
      opening,
      pack: findPack(opening.packCode),
      packQuantity: opening.packQuantity ?? 1,
      totalPrice: Number(opening.priceAmount),
      cards: Object.freeze(cards),
      templates: Object.freeze(cards.map((card) => card.template)),
      instances: Object.freeze(cards.map((card) => card.instance)),
      template: firstCard?.template ?? null,
      instance: firstCard?.instance ?? null,
      replayed,
    });
  }

  return Object.freeze({
    getOdds(packCode) {
      return Object.freeze({ source: "pack", ...findPack(packCode) });
    },
    listPacks() {
      return Object.freeze([...catalog.packs.values()]);
    },
    async openPack(
      { playerId, packCode, interactionId, quantity = 1 },
      { database: suppliedDatabase } = {},
    ) {
      const pack = findPack(packCode);
      const packQuantity = normalizeQuantity(quantity);
      const totalPrice = pack.priceAmount * packQuantity;
      const totalCards = pack.cardCount * packQuantity;
      if (!Number.isSafeInteger(totalPrice) || totalCards > 500) {
        throw new PackError("PACK_BATCH_TOO_LARGE", "This Pack batch is too large.");
      }
      const operation = async (database) => {
        const existing = await packOpeningRepository.findByInteractionId(database, interactionId);
        if (existing) {
          if (
            existing.playerId !== String(playerId) ||
            existing.packCode !== pack.packCode ||
            (existing.packQuantity ?? 1) !== packQuantity ||
            existing.status !== "COMPLETED"
          ) {
            throw new PackError("PACK_IDEMPOTENCY_CONFLICT", "This interaction is already associated with another Pack operation.");
          }
          return hydrate(database, existing, true);
        }
        await securityService?.assertPlayerActive({ playerId }, { database });
        const currentTime = await cooldownRepository.getDatabaseTime(database);
        const cooldownType = `PACK_${pack.packCode.toUpperCase()}`;
        const cooldown = await cooldownRepository.getOrCreateForUpdate(database, { playerId, cooldownType });
        if (cooldown.availableAt > currentTime) {
          throw new PackError("PACK_COOLDOWN_ACTIVE", "This Pack is being opened too quickly.", { availableAt: cooldown.availableAt });
        }
        const opening = await packOpeningRepository.create(database, {
          playerId,
          packCode: pack.packCode,
          paymentCurrency: pack.priceCurrency,
          priceAmount: totalPrice,
          packQuantity,
          interactionId,
        });
        try {
          await economyService.debit({
            playerId, currency: pack.priceCurrency, amount: totalPrice,
            transactionType: "PACK_PURCHASE", referenceType: "PACK_OPENING",
            referenceId: opening.packOpeningId,
            idempotencyKey: `pack:${interactionId}:${pack.priceCurrency.toLowerCase()}`,
          }, { database });
        } catch (error) {
          const insufficientCode = `INSUFFICIENT_${pack.priceCurrency}`;
          if (error instanceof EconomyError && error.code === insufficientCode) {
            const currencyName = pack.priceCurrency === EconomyCurrency.GOLD
              ? "Gold"
              : "Shards";
            throw new PackError(
              insufficientCode,
              `You need ${totalPrice} ${currencyName} to open this Pack batch.`,
            );
          }
          throw error;
        }
        const templatePools = await getTemplatePools(database);
        const selections = [];
        for (let index = 0; index < totalCards; index += 1) {
          const template = pickTemplate(templatePools, pack, rollInteger);
          const cardPosition = index + 1;
          selections.push(Object.freeze({
            template,
            cardPosition,
            mintInput: {
            cardTemplateId: template.cardTemplateId, ownerPlayerId: playerId,
            cardLevel: rollCardLevel(pack.levelWeights, rollInteger), obtainedMethod: "PACK",
            referenceType: "PACK_OPENING",
            referenceId: `${opening.packOpeningId}:${cardPosition}`,
            },
          }));
        }
        const mints = await cardInstanceService.mintCards(
          selections.map((selection) => selection.mintInput),
          { database },
        );
        const openingCards = await packOpeningRepository.addCards(database, {
          packOpeningId: opening.packOpeningId,
          cards: selections.map((selection, index) => ({
            cardPosition: selection.cardPosition,
            cardTemplateId: selection.template.cardTemplateId,
            cardInstanceId: mints[index].instance.cardInstanceId,
          })),
        });
        const cards = selections.map((selection, index) => Object.freeze({
          openingCard: openingCards[index],
          template: selection.template,
          instance: mints[index].instance,
        }));
        const firstCard = cards[0];
        const completed = await packOpeningRepository.complete(database, {
          packOpeningId: opening.packOpeningId,
          cardTemplateId: firstCard.template.cardTemplateId,
          cardInstanceId: firstCard.instance.cardInstanceId,
        });
        await cooldownRepository.setAvailableAt(database, {
          playerId, cooldownType,
          availableAt: addSeconds(currentTime, pack.cooldownSeconds),
        });
        return Object.freeze({
          source: "pack",
          opening: completed,
          pack,
          packQuantity,
          totalPrice,
          cards: Object.freeze(cards),
          templates: Object.freeze(cards.map((card) => card.template)),
          instances: Object.freeze(cards.map((card) => card.instance)),
          template: firstCard.template,
          instance: firstCard.instance,
          replayed: false,
        });
      };
      return suppliedDatabase
        ? operation(suppliedDatabase)
        : withTransaction(databasePool, operation);
    },
  });
}
