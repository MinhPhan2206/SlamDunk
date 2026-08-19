import { withTransaction } from "../../database/transaction/transaction-manager.js";
import { TraitError } from "./trait.errors.js";
import { traitRepository } from "./trait.repository.js";

const CODE_PATTERN = /^[A-Z][A-Z0-9_]*$/;

function normalizeId(value, fieldName) {
  const normalized = String(value);

  if (!/^\d+$/.test(normalized) || BigInt(normalized) <= 0n) {
    throw new TypeError(`${fieldName} must be a positive integer.`);
  }

  return normalized;
}

function normalizeRequiredText(value, fieldName) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${fieldName} must be a non-empty string.`);
  }

  return value.trim();
}

function normalizeCode(value, fieldName) {
  const normalized = normalizeRequiredText(value, fieldName);

  if (!CODE_PATTERN.test(normalized)) {
    throw new TypeError(
      `${fieldName} must use uppercase letters, numbers, and underscores.`,
    );
  }

  return normalized;
}

function normalizeDefinitionInput(input) {
  if (!input || typeof input !== "object") {
    throw new TypeError("Trait Definition input is required.");
  }

  if (input.active != null && typeof input.active !== "boolean") {
    throw new TypeError("active must be a boolean.");
  }

  return Object.freeze({
    traitCode: normalizeCode(input.traitCode, "traitCode"),
    traitName: normalizeRequiredText(input.traitName, "traitName"),
    traitType: normalizeCode(input.traitType, "traitType"),
    description: normalizeRequiredText(input.description, "description"),
    active: input.active ?? true,
  });
}

function normalizeTraitTier(traitTier) {
  if (!Number.isInteger(traitTier) || traitTier < 1 || traitTier > 5) {
    throw new TypeError("traitTier must be an integer from 1 through 5.");
  }

  return traitTier;
}

async function useTransaction(databasePool, database, operation) {
  if (database) {
    return operation(database);
  }

  return withTransaction(databasePool, operation);
}

function translateUniqueViolation(error, code, message) {
  if (error?.code === "23505") {
    throw new TraitError(code, message);
  }

  throw error;
}

export function createTraitService({ databasePool, cardTemplateService }) {
  async function getDefinition(traitId, { database = databasePool } = {}) {
    const definition = await traitRepository.findDefinitionById(
      database,
      normalizeId(traitId, "traitId"),
    );

    if (!definition) {
      throw new TraitError("TRAIT_NOT_FOUND", "Trait was not found.");
    }

    return definition;
  }

  async function getTraitsForTemplate(
    cardTemplateId,
    { database = databasePool } = {},
  ) {
    const normalizedCardTemplateId = normalizeId(
      cardTemplateId,
      "cardTemplateId",
    );
    await cardTemplateService.getTemplate(normalizedCardTemplateId, {
      database,
    });

    return traitRepository.findByCardTemplateId(
      database,
      normalizedCardTemplateId,
    );
  }

  return Object.freeze({
    async createDefinition(input, { database = databasePool } = {}) {
      try {
        return await traitRepository.createDefinition(
          database,
          normalizeDefinitionInput(input),
        );
      } catch (error) {
        translateUniqueViolation(
          error,
          "TRAIT_CODE_ALREADY_EXISTS",
          "Trait code already exists.",
        );
      }
    },

    getDefinition,

    async getDefinitionByCode(traitCode, { database = databasePool } = {}) {
      const definition = await traitRepository.findDefinitionByCode(
        database,
        normalizeCode(traitCode, "traitCode"),
      );

      if (!definition) {
        throw new TraitError("TRAIT_NOT_FOUND", "Trait was not found.");
      }

      return definition;
    },

    async assignTraitToTemplate(
      { cardTemplateId, traitId, traitTier },
      { database } = {},
    ) {
      const normalizedCardTemplateId = normalizeId(
        cardTemplateId,
        "cardTemplateId",
      );
      const normalizedTraitId = normalizeId(traitId, "traitId");
      const normalizedTraitTier = normalizeTraitTier(traitTier);

      return useTransaction(
        databasePool,
        database,
        async (transactionDatabase) => {
          await cardTemplateService.getTemplate(normalizedCardTemplateId, {
            database: transactionDatabase,
          });
          const traitDefinition = await getDefinition(normalizedTraitId, {
            database: transactionDatabase,
          });

          if (!traitDefinition.active) {
            throw new TraitError(
              "TRAIT_INACTIVE",
              "Inactive Traits cannot be assigned to Card Templates.",
            );
          }

          const existingAssignment = await traitRepository.findAssignment(
            transactionDatabase,
            {
              cardTemplateId: normalizedCardTemplateId,
              traitId: normalizedTraitId,
            },
          );

          if (existingAssignment) {
            throw new TraitError(
              "TRAIT_ALREADY_ASSIGNED",
              "Trait is already assigned to this Card Template.",
            );
          }

          try {
            return await traitRepository.createAssignment(transactionDatabase, {
              cardTemplateId: normalizedCardTemplateId,
              traitId: normalizedTraitId,
              traitTier: normalizedTraitTier,
            });
          } catch (error) {
            translateUniqueViolation(
              error,
              "TRAIT_ALREADY_ASSIGNED",
              "Trait is already assigned to this Card Template.",
            );
          }
        },
      );
    },

    getTraitsForTemplate,

    async getTraitsForTemplates(
      cardTemplateIds,
      { database = databasePool } = {},
    ) {
      if (!Array.isArray(cardTemplateIds)) {
        throw new TypeError("cardTemplateIds must be an array.");
      }
      const normalizedIds = [...new Set(cardTemplateIds.map((cardTemplateId) =>
        normalizeId(cardTemplateId, "cardTemplateId")
      ))];
      return traitRepository.findByCardTemplateIds(database, normalizedIds);
    },

    async getTotalTraitLevel(
      cardTemplateId,
      { database = databasePool } = {},
    ) {
      const traits = await getTraitsForTemplate(cardTemplateId, {
        database,
      });

      return traits.reduce((total, trait) => total + trait.traitTier, 0);
    },
  });
}
