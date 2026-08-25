import { randomInt } from "node:crypto";

import { getRarityDefinition } from "../../config/rarity-config.js";
import { withTransaction } from "../../database/transaction/transaction-manager.js";
import {
  normalizeCardLevelWeights,
  rollCardLevel,
} from "../card/card-level-roll.js";
import { ContractError } from "./contract.errors.js";
import { contractRepository } from "./contract.repository.js";

const REFERENCE_TYPE = "PLAYER_CONTRACT";

function requiredText(value, fieldName) {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new TypeError(`${fieldName} is required.`);
  return normalized;
}

function playerId(value) {
  const normalized = requiredText(value, "playerId");
  if (!/^\d+$/.test(normalized) || BigInt(normalized) <= 0n) {
    throw new TypeError("playerId must be a positive integer.");
  }
  return normalized;
}

function normalizeCatalog(catalog) {
  if (!Array.isArray(catalog) || catalog.length === 0) {
    throw new TypeError("contractCatalog must not be empty.");
  }
  const codes = new Set();
  return Object.freeze(catalog.map((contract) => {
    const contractCode = requiredText(contract.contractCode, "contractCode").toLowerCase();
    if (codes.has(contractCode)) throw new TypeError("Contract codes must be unique.");
    codes.add(contractCode);
    return Object.freeze({
      contractCode,
      displayName: requiredText(contract.displayName, "displayName"),
      itemType: requiredText(contract.itemType, "itemType").toUpperCase(),
      rarityCode: getRarityDefinition(
        requiredText(contract.rarityCode, "rarityCode").toUpperCase(),
      ).rarityCode,
      levelWeights: normalizeCardLevelWeights(contract.levelWeights),
    });
  }));
}

function chooseTemplate(templates, rarityCode, rollInteger) {
  const candidates = templates.filter((template) => template.rarityCode === rarityCode);
  if (candidates.length === 0) {
    throw new ContractError(
      "CARD_TEMPLATE_UNAVAILABLE",
      `No active ${getRarityDefinition(rarityCode).name} Card is available.`,
    );
  }
  return candidates[rollInteger(0, candidates.length)];
}

export function createContractService({
  databasePool,
  inventoryService,
  cardTemplateService,
  cardInstanceService,
  securityService,
  contractCatalog,
  rollInteger = randomInt,
}) {
  const catalog = normalizeCatalog(contractCatalog);
  const byCode = new Map(catalog.map((contract) => [contract.contractCode, contract]));

  return Object.freeze({
    catalog,

    async openContract(
      { playerId: rawPlayerId, contractCode: rawContractCode, interactionId: rawInteractionId },
      { database } = {},
    ) {
      const normalizedPlayerId = playerId(rawPlayerId);
      const contractCode = requiredText(rawContractCode, "contractCode").toLowerCase();
      const interactionId = requiredText(rawInteractionId, "interactionId");
      const contract = byCode.get(contractCode);
      if (!contract) throw new ContractError("CONTRACT_NOT_FOUND", "Contract type was not found.");

      const operation = async (transactionDatabase) => {
        await transactionDatabase.query(
          "SELECT pg_advisory_xact_lock(hashtext($1))",
          [`player-contract:${interactionId}`],
        );
        const existing = await contractRepository.findByInteractionId(
          transactionDatabase,
          interactionId,
        );
        if (existing) {
          if (
            existing.playerId !== normalizedPlayerId ||
            existing.contractCode !== contract.contractCode
          ) {
            throw new ContractError(
              "CONTRACT_IDEMPOTENCY_CONFLICT",
              "This interaction was already used for another Contract.",
            );
          }
          const [template, instance] = await Promise.all([
            cardTemplateService.getTemplate(existing.cardTemplateId, {
              database: transactionDatabase,
            }),
            cardInstanceService.getInstance(existing.cardInstanceId, {
              database: transactionDatabase,
            }),
          ]);
          return Object.freeze({ contract, opening: existing, template, instance, replayed: true });
        }

        await securityService?.assertPlayerActive(
          { playerId: normalizedPlayerId },
          { database: transactionDatabase },
        );

        const remainingQuantity = await inventoryService.consumeItem({
          playerId: normalizedPlayerId,
          itemType: contract.itemType,
          quantity: 1,
        }, { database: transactionDatabase });
        if (remainingQuantity == null) {
          throw new ContractError(
            "CONTRACT_ITEM_MISSING",
            `You do not have an ${contract.displayName}.`,
          );
        }
        const templates = await cardTemplateService.listPackableTemplates({
          database: transactionDatabase,
        });
        const template = chooseTemplate(templates, contract.rarityCode, rollInteger);
        const cardLevel = rollCardLevel(contract.levelWeights, rollInteger);
        const minted = await cardInstanceService.mintCard({
          cardTemplateId: template.cardTemplateId,
          ownerPlayerId: normalizedPlayerId,
          cardLevel,
          obtainedMethod: "EVENT_REWARD",
          accountBound: true,
          referenceType: REFERENCE_TYPE,
          referenceId: interactionId,
        }, { database: transactionDatabase });
        const opening = await contractRepository.create(transactionDatabase, {
          playerId: normalizedPlayerId,
          contractCode: contract.contractCode,
          itemType: contract.itemType,
          interactionId,
          cardTemplateId: template.cardTemplateId,
          cardInstanceId: minted.instance.cardInstanceId,
        });
        return Object.freeze({
          contract,
          opening,
          template,
          instance: minted.instance,
          remainingQuantity,
          replayed: false,
        });
      };
      return database
        ? operation(database)
        : withTransaction(databasePool, operation);
    },
  });
}
