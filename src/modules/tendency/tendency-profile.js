export const TENDENCY_SCHEMA_VERSION = "tendency-v1";

export const DECISION_TENDENCIES = Object.freeze([
  "BALANCED",
  "PASS_FIRST",
  "SCORE_FIRST",
]);

export const SHOT_PROFILE_TENDENCIES = Object.freeze([
  "BALANCED",
  "RIM_PRESSURE",
  "PERIMETER",
  "MID_RANGE",
  "POST",
]);

export const CREATION_ROLE_TENDENCIES = Object.freeze([
  "BALANCED",
  "PICK_ROLL_HANDLER",
  "OFF_BALL",
]);

export const USAGE_TENDENCIES = Object.freeze([
  "NORMAL",
  "LOW",
]);

export const DEFAULT_TENDENCY_PROFILE = Object.freeze({
  schemaVersion: TENDENCY_SCHEMA_VERSION,
  decision: "BALANCED",
  shotProfile: "BALANCED",
  creationRole: "BALANCED",
  usage: "NORMAL",
});

const PROFILE_KEYS = new Set(Object.keys(DEFAULT_TENDENCY_PROFILE));

function assertKnownValue(value, values, fieldName) {
  if (!values.includes(value)) {
    throw new TypeError(`${fieldName} has an unsupported value.`);
  }
}

export function normalizeTendencyProfile(value = DEFAULT_TENDENCY_PROFILE) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("tendencyProfile must be an object.");
  }
  for (const key of Object.keys(value)) {
    if (!PROFILE_KEYS.has(key)) {
      throw new TypeError(`tendencyProfile contains unknown field: ${key}.`);
    }
  }
  if (value.schemaVersion !== TENDENCY_SCHEMA_VERSION) {
    throw new TypeError("tendencyProfile.schemaVersion is unsupported.");
  }
  assertKnownValue(value.decision, DECISION_TENDENCIES, "tendencyProfile.decision");
  assertKnownValue(
    value.shotProfile,
    SHOT_PROFILE_TENDENCIES,
    "tendencyProfile.shotProfile",
  );
  assertKnownValue(
    value.creationRole,
    CREATION_ROLE_TENDENCIES,
    "tendencyProfile.creationRole",
  );
  assertKnownValue(value.usage, USAGE_TENDENCIES, "tendencyProfile.usage");
  return Object.freeze({
    schemaVersion: value.schemaVersion,
    decision: value.decision,
    shotProfile: value.shotProfile,
    creationRole: value.creationRole,
    usage: value.usage,
  });
}
