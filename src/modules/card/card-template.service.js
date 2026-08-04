import { CardError } from "./card.errors.js";
import { cardTemplateRepository } from "./card-template.repository.js";

const POSITIONS = new Set(["PG", "SG", "SF", "PF", "C"]);
const SMALLINT_MAX = 32_767;
const STAT_FIELDS = [
  "insideScoring",
  "midRange",
  "threePoint",
  "playmaking",
  "perimeterDefense",
  "interiorDefense",
  "rebounding",
  "athleticism",
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

function normalizeOptionalText(value, fieldName) {
  if (value == null) {
    return null;
  }

  return normalizeRequiredText(value, fieldName);
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

function normalizeReleaseDate(value) {
  if (value == null) {
    return null;
  }

  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new TypeError("releaseDate must use YYYY-MM-DD format.");
  }

  const parsedDate = new Date(`${value}T00:00:00.000Z`);

  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== value
  ) {
    throw new TypeError("releaseDate must be a valid calendar date.");
  }

  return value;
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
    edition: normalizeRequiredText(input.edition, "edition"),
    season: normalizeOptionalText(input.season, "season"),
    primaryPosition,
    secondaryPosition,
    rarityTier: normalizeInteger(input.rarityTier, "rarityTier", 1, 7),
    overall: normalizeInteger(input.overall, "overall", 60, 99),
    heightCm: normalizeOptionalMeasurement(input.heightCm, "heightCm"),
    weightKg: normalizeOptionalMeasurement(input.weightKg, "weightKg"),
    packable: input.packable ?? true,
    releaseDate: normalizeReleaseDate(input.releaseDate),
  };

  if (typeof normalized.packable !== "boolean") {
    throw new TypeError("packable must be a boolean.");
  }

  for (const fieldName of STAT_FIELDS) {
    normalized[fieldName] = normalizeInteger(
      input[fieldName],
      fieldName,
      0,
      SMALLINT_MAX,
    );
  }

  return Object.freeze(normalized);
}

export function createCardTemplateService({ databasePool }) {
  return Object.freeze({
    async createTemplate(input, { database = databasePool } = {}) {
      return cardTemplateRepository.create(
        database,
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
      rarityTier,
      { database = databasePool, limit = 20 } = {},
    ) {
      const normalizedRarityTier = normalizeInteger(
        rarityTier,
        "rarityTier",
        1,
        7,
      );
      const normalizedLimit = normalizeInteger(limit, "limit", 1, 20);
      const result = await cardTemplateRepository.findByRarityTier(
        database,
        normalizedRarityTier,
        normalizedLimit,
      );

      return Object.freeze({
        rarityTier: normalizedRarityTier,
        templates: result.templates,
        total: result.total,
      });
    },
  });
}
