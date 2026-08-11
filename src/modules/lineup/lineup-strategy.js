import {
  DEFAULT_TENDENCY_PROFILE,
  normalizeTendencyProfile,
} from "../tendency/index.js";

export const STRATEGY_SCHEMA_VERSION = "strategy-v4";

export const MAIN_HANDLER_CODES = Object.freeze(["PG", "SG", "SF", "PF", "C"]);

export const OFFENSE_STYLE_CODES = Object.freeze([
  "BALANCED", "PACE_SPACE", "MOTION", "PICK_GAME", "ISO_CREATOR",
  "RIM_PRESSURE", "POST_HUB", "TRANSITION",
]);

export const TEMPO_CODES = Object.freeze(["PATIENT", "STANDARD", "QUICK"]);

export const DEFENSE_PLAN_CODES = Object.freeze([
  "BALANCED", "SWITCH", "DROP", "BLITZ", "GO_UNDER", "STAY_HOME",
  "PACK_PAINT",
]);

export const REBOUNDING_POLICY_CODES = Object.freeze([
  "BALANCED", "CRASH_GLASS", "GET_BACK",
]);

const STRATEGY_KEYS = Object.freeze([
  "schemaVersion", "mainHandler", "playerTendencies", "offense", "tempo",
  "defense", "rebounding",
]);

function assertKnownCode(value, allowedValues, fieldName) {
  if (!allowedValues.includes(value)) {
    throw new TypeError(`${fieldName} has an unsupported value.`);
  }
}

function normalizeCardInstanceId(value) {
  const normalized = String(value);
  if (!/^\d+$/.test(normalized) || BigInt(normalized) <= 0n) {
    throw new TypeError("playerTendencies keys must be Card Instance IDs.");
  }
  return normalized;
}

export function normalizePlayerTendencies(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("strategy.playerTendencies must be an object.");
  }
  return Object.freeze(Object.fromEntries(Object.entries(value).map(
    ([cardInstanceId, profile]) => [
      normalizeCardInstanceId(cardInstanceId),
      normalizeTendencyProfile(profile),
    ],
  )));
}

export const DEFAULT_LINEUP_STRATEGY = Object.freeze({
  schemaVersion: STRATEGY_SCHEMA_VERSION,
  mainHandler: "PG",
  playerTendencies: Object.freeze({}),
  offense: "BALANCED",
  tempo: "STANDARD",
  defense: "BALANCED",
  rebounding: "BALANCED",
});

export function getPlayerTendency(strategy, cardInstanceId) {
  const key = cardInstanceId === null || cardInstanceId === undefined
    ? null
    : String(cardInstanceId);
  return key && strategy.playerTendencies[key]
    ? strategy.playerTendencies[key]
    : DEFAULT_TENDENCY_PROFILE;
}

export function setPlayerTendency(strategy, cardInstanceId, profile) {
  const key = normalizeCardInstanceId(cardInstanceId);
  return normalizeLineupStrategy({
    ...strategy,
    playerTendencies: {
      ...strategy.playerTendencies,
      [key]: normalizeTendencyProfile(profile),
    },
  });
}

export function prunePlayerTendencies(strategy, cardInstanceIds) {
  const allowed = new Set(cardInstanceIds.map(String));
  return normalizeLineupStrategy({
    ...strategy,
    playerTendencies: Object.fromEntries(
      Object.entries(strategy.playerTendencies)
        .filter(([cardInstanceId]) => allowed.has(cardInstanceId)),
    ),
  });
}

export function normalizeLineupStrategy(value) {
  if (value === undefined) return DEFAULT_LINEUP_STRATEGY;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("strategy must be an object.");
  }
  const keys = Object.keys(value);
  const unknownKey = keys.find((key) => !STRATEGY_KEYS.includes(key));
  if (unknownKey) {
    throw new TypeError(`strategy contains unsupported field: ${unknownKey}.`);
  }
  const missingKey = STRATEGY_KEYS.find((key) => !Object.hasOwn(value, key));
  if (missingKey) {
    throw new TypeError(`strategy is missing required field: ${missingKey}.`);
  }
  if (value.schemaVersion !== STRATEGY_SCHEMA_VERSION) {
    throw new TypeError("strategy.schemaVersion is unsupported.");
  }

  assertKnownCode(value.mainHandler, MAIN_HANDLER_CODES, "strategy.mainHandler");
  assertKnownCode(value.offense, OFFENSE_STYLE_CODES, "strategy.offense");
  assertKnownCode(value.tempo, TEMPO_CODES, "strategy.tempo");
  assertKnownCode(value.defense, DEFENSE_PLAN_CODES, "strategy.defense");
  assertKnownCode(value.rebounding, REBOUNDING_POLICY_CODES, "strategy.rebounding");

  return Object.freeze({
    schemaVersion: STRATEGY_SCHEMA_VERSION,
    mainHandler: value.mainHandler,
    playerTendencies: normalizePlayerTendencies(value.playerTendencies),
    offense: value.offense,
    tempo: value.tempo,
    defense: value.defense,
    rebounding: value.rebounding,
  });
}
