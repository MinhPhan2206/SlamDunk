import { randomInt } from "node:crypto";

import { withTransaction } from "../../database/transaction/transaction-manager.js";
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
      !Number.isSafeInteger(definition.priceGold) || definition.priceGold <= 0 ||
      !Number.isSafeInteger(definition.cooldownSeconds) || definition.cooldownSeconds <= 0 ||
      definition.cardCount !== 1 || packs.has(definition.packCode)
    ) {
      throw new TypeError("Each Pack requires valid, unique product configuration.");
    }
    const pack = Object.freeze({
      packCode: definition.packCode,
      displayName: definition.displayName.trim(),
      priceGold: definition.priceGold,
      cooldownSeconds: definition.cooldownSeconds,
      cardCount: definition.cardCount,
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

function pickTemplate(templates, pack, rollInteger) {
  const byTier = new Map();
  for (const template of templates) {
    const entries = byTier.get(template.rarityTier) ?? [];
    entries.push(template);
    byTier.set(template.rarityTier, entries);
  }
  const available = pack.rarityWeights.filter(({ rarityTier }) => byTier.has(rarityTier));
  if (!available.length) throw new PackError("PACK_CATALOG_EMPTY", "No eligible cards are available for this Pack.");
  const total = available.reduce((sum, entry) => sum + entry.weight, 0);
  const roll = rollInteger(0, total);
  let cumulative = 0;
  let tier = available.at(-1).rarityTier;
  for (const entry of available) {
    cumulative += entry.weight;
    if (roll < cumulative) { tier = entry.rarityTier; break; }
  }
  const candidates = byTier.get(tier);
  return candidates[rollInteger(0, candidates.length)];
}

function addSeconds(date, seconds) {
  return new Date(date.getTime() + seconds * 1_000);
}

export function createPackService({
  packCatalog,
  databasePool,
  economyService,
  cardTemplateService,
  cardInstanceService,
  rollInteger = randomInt,
}) {
  const catalog = normalizeCatalog(packCatalog);
  const findPack = (packCode = catalog.defaultPackCode) => {
    const normalizedCode = String(packCode).trim().toLowerCase();
    const pack = catalog.packs.get(normalizedCode);
    if (!pack) throw new PackError("PACK_NOT_FOUND", `Pack '${normalizedCode}' is not configured.`);
    return pack;
  };

  async function hydrate(database, opening, replayed) {
    return Object.freeze({
      source: "pack",
      opening,
      pack: findPack(opening.packCode),
      template: await cardTemplateService.getTemplate(opening.cardTemplateId, { database }),
      instance: await cardInstanceService.getInstance(opening.cardInstanceId, { database }),
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
    async openPack({ playerId, packCode, interactionId }, { database: suppliedDatabase } = {}) {
      const pack = findPack(packCode);
      const operation = async (database) => {
        const existing = await packOpeningRepository.findByInteractionId(database, interactionId);
        if (existing) {
          if (existing.playerId !== String(playerId) || existing.packCode !== pack.packCode || existing.status !== "COMPLETED") {
            throw new PackError("PACK_IDEMPOTENCY_CONFLICT", "This interaction is already associated with another Pack operation.");
          }
          return hydrate(database, existing, true);
        }
        const currentTime = await cooldownRepository.getDatabaseTime(database);
        const cooldownType = `PACK_${pack.packCode.toUpperCase()}`;
        const cooldown = await cooldownRepository.getOrCreateForUpdate(database, { playerId, cooldownType });
        if (cooldown.availableAt > currentTime) {
          throw new PackError("PACK_COOLDOWN_ACTIVE", "This Pack is being opened too quickly.", { availableAt: cooldown.availableAt });
        }
        const opening = await packOpeningRepository.create(database, {
          playerId, packCode: pack.packCode, priceGold: pack.priceGold, interactionId,
        });
        try {
          await economyService.debit({
            playerId, currency: EconomyCurrency.GOLD, amount: pack.priceGold,
            transactionType: "PACK_PURCHASE", referenceType: "PACK_OPENING",
            referenceId: opening.packOpeningId, idempotencyKey: `pack:${interactionId}:gold`,
          }, { database });
        } catch (error) {
          if (error instanceof EconomyError && error.code === "INSUFFICIENT_GOLD") {
            throw new PackError("INSUFFICIENT_GOLD", `You need ${pack.priceGold} Gold to open this Pack.`);
          }
          throw error;
        }
        const template = pickTemplate(await cardTemplateService.listPackableTemplates({ database }), pack, rollInteger);
        const mint = await cardInstanceService.mintCard({
          cardTemplateId: template.cardTemplateId, ownerPlayerId: playerId,
          cardLevel: rollInteger(1, 6), obtainedMethod: "PACK",
          referenceType: "PACK_OPENING", referenceId: opening.packOpeningId,
        }, { database });
        const completed = await packOpeningRepository.complete(database, {
          packOpeningId: opening.packOpeningId,
          cardTemplateId: template.cardTemplateId,
          cardInstanceId: mint.instance.cardInstanceId,
        });
        await cooldownRepository.setAvailableAt(database, {
          playerId, cooldownType,
          availableAt: addSeconds(currentTime, pack.cooldownSeconds),
        });
        return Object.freeze({ source: "pack", opening: completed, pack, template, instance: mint.instance, replayed: false });
      };
      return suppliedDatabase
        ? operation(suppliedDatabase)
        : withTransaction(databasePool, operation);
    },
  });
}
