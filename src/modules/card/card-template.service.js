import { CardError } from "./card.errors.js";
import { cardTemplateRepository } from "./card-template.repository.js";
import { getRarityDefinition } from "../../config/rarity-config.js";

const POSITIONS = new Set(["PG", "SG", "SF", "PF", "C"]);
const TEMPLATE_SORTS = Object.freeze({
  alphabet: "Alphabetical",
  finishing: "Finishing",
  mid_range: "Mid Range",
  three_point: "3 Point",
  playmaking: "Playmaking",
  interior_defense: "Interior Defense",
  perimeter_defense: "Perimeter Defense",
  strength: "Strength",
});
const SMALLINT_MAX = 32_767;
const STAT_FIELDS = [
  "finishing",
  "midRange",
  "threePoint",
  "playmaking",
  "perimeterDefense",
  "interiorDefense",
  "strength",
];

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

function normalizeInteger(value, fieldName, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new TypeError(
      `${fieldName} must be an integer from ${minimum} through ${maximum}.`,
    );
  }

  return value;
}

function normalizePosition(value, fieldName, { optional = false } = {}) {
  if (optional && value == null) {
    return null;
  }

  if (!POSITIONS.has(value)) {
    throw new TypeError(`${fieldName} must be PG, SG, SF, PF, or C.`);
  }

  return value;
}

function normalizeOptionalMeasurement(value, fieldName) {
  if (value == null) {
    return null;
  }

  return normalizeInteger(value, fieldName, 1, SMALLINT_MAX);
}

function normalizeTemplateInput(input) {
  if (!input || typeof input !== "object") {
    throw new TypeError("Card Template input is required.");
  }

  const primaryPosition = normalizePosition(
    input.primaryPosition,
    "primaryPosition",
  );
  const secondaryPosition = normalizePosition(
    input.secondaryPosition,
    "secondaryPosition",
    { optional: true },
  );

  if (primaryPosition === secondaryPosition) {
    throw new TypeError("secondaryPosition must differ from primaryPosition.");
  }

  const normalized = {
    playerName: normalizeRequiredText(input.playerName, "playerName"),
    primaryPosition,
    secondaryPosition,
    rarityCode: getRarityDefinition(
      normalizeRequiredText(input.rarityCode, "rarityCode").toUpperCase(),
    ).rarityCode,
    overall: normalizeInteger(input.overall, "overall", 60, 99),
    heightCm: normalizeOptionalMeasurement(input.heightCm, "heightCm"),
    packable: input.packable ?? true,
  };

  if (typeof normalized.packable !== "boolean") {
    throw new TypeError("packable must be a boolean.");
  }

  for (const fieldName of STAT_FIELDS) {
    const value = fieldName === "strength" && input[fieldName] == null
      ? 50
      : input[fieldName];
    normalized[fieldName] = normalizeInteger(
      value,
      fieldName,
      0,
      SMALLINT_MAX,
    );
  }

  return Object.freeze(normalized);
}

export function createCardTemplateService({ databasePool }) {
  return Object.freeze({
    async listPackableTemplates({ database = databasePool } = {}) {
      return cardTemplateRepository.findPackable(database);
    },

    async createTemplate(input, { database = databasePool } = {}) {
      return cardTemplateRepository.create(
        database,
        normalizeTemplateInput(input),
      );
    },

    async updateTemplate(cardTemplateId, input, { database = databasePool } = {}) {
      return cardTemplateRepository.update(
        database,
        normalizeId(cardTemplateId, "cardTemplateId"),
        normalizeTemplateInput(input),
      );
    },

    async getTemplate(cardTemplateId, { database = databasePool } = {}) {
      const template = await cardTemplateRepository.findById(
        database,
        normalizeId(cardTemplateId, "cardTemplateId"),
      );

      if (!template) {
        throw new CardError(
          "CARD_TEMPLATE_NOT_FOUND",
          "Card Template was not found.",
        );
      }

      return template;
    },

    async listTemplatesByRarity(
      rarityCode,
      {
        database = databasePool,
        position = null,
        sortBy = "alphabet",
        page = 1,
        pageSize = 10,
      } = {},
    ) {
      const normalizedRarityCode = getRarityDefinition(
        normalizeRequiredText(rarityCode, "rarityCode").toUpperCase(),
      ).rarityCode;
      const normalizedPosition = normalizePosition(position, "position", {
        optional: true,
      });
      const normalizedSortBy = String(sortBy).trim().toLowerCase();
      if (!TEMPLATE_SORTS[normalizedSortBy]) {
        throw new TypeError("sortBy is not supported.");
      }
      const normalizedPage = normalizeInteger(page, "page", 1, 1_000_000);
      const normalizedPageSize = normalizeInteger(pageSize, "pageSize", 1, 20);
      const result = await cardTemplateRepository.findByRarityCode(
        database,
        {
          rarityCode: normalizedRarityCode,
          position: normalizedPosition,
          sortBy: normalizedSortBy,
          limit: normalizedPageSize,
          offset: (normalizedPage - 1) * normalizedPageSize,
        },
      );
      const total = Number(result.total);

      return Object.freeze({
        rarityCode: normalizedRarityCode,
        templates: result.templates,
        total,
        page: normalizedPage,
        totalPages: Math.ceil(total / normalizedPageSize),
        position: normalizedPosition,
        sortBy: normalizedSortBy,
        sortLabel: TEMPLATE_SORTS[normalizedSortBy],
      });
    },
  });
}
