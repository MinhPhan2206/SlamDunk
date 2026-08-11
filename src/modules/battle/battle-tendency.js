import {
  DEFAULT_TENDENCY_PROFILE,
  normalizeTendencyProfile,
} from "../tendency/index.js";

export const BATTLE_TENDENCY_RESOLVER_VERSION = "battle-tendencies-v2";

const DECISION_MULTIPLIERS = Object.freeze({
  BALANCED: Object.freeze({}),
  PASS_FIRST: Object.freeze({
    PASS: 1.25, EXTRA_PASS: 1.30, DRIVE_AND_KICK: 1.22,
    POST_KICK_OUT: 1.18, PICK_AND_ROLL: 1.14, DRIBBLE_HANDOFF: 1.14,
    RESET_OFFENSE: 1.18, THREE_POINT: 0.82, MID_RANGE: 0.82,
    DRIVE: 0.88, POST_UP: 0.88,
  }),
  SCORE_FIRST: Object.freeze({
    THREE_POINT: 1.18, MID_RANGE: 1.18, DRIVE: 1.18,
    POST_UP: 1.12, CREATE_SEPARATION: 1.18, PASS: 0.80,
    EXTRA_PASS: 0.82, RESET_OFFENSE: 0.78,
  }),
});

const SHOT_PROFILE_MULTIPLIERS = Object.freeze({
  BALANCED: Object.freeze({}),
  RIM_PRESSURE: Object.freeze({
    DRIVE: 1.28, CUT: 1.18, PICK_AND_ROLL: 1.15, FAST_BREAK: 1.15,
    THREE_POINT: 0.84, MID_RANGE: 0.90,
  }),
  PERIMETER: Object.freeze({
    THREE_POINT: 1.28, PICK_AND_POP: 1.18, OFF_BALL_SCREEN: 1.15,
    RELOCATE: 1.20, POST_UP: 0.82,
  }),
  MID_RANGE: Object.freeze({
    MID_RANGE: 1.30, CREATE_SEPARATION: 1.15,
    THREE_POINT: 0.90, POST_UP: 0.90,
  }),
  POST: Object.freeze({
    POST_UP: 1.30, POST_KICK_OUT: 1.18, RESET_OFFENSE: 1.08,
    FAST_BREAK: 0.82, THREE_POINT: 0.88,
  }),
});

const CREATION_ROLE_MULTIPLIERS = Object.freeze({
  BALANCED: Object.freeze({}),
  PICK_ROLL_HANDLER: Object.freeze({
    PICK_AND_ROLL: 1.28, PICK_AND_POP: 1.25,
    DRIBBLE_HANDOFF: 1.18, DRIVE_AND_KICK: 1.12,
  }),
  OFF_BALL: Object.freeze({
    CUT: 1.25, OFF_BALL_SCREEN: 1.28, RELOCATE: 1.25, EXTRA_PASS: 1.12,
  }),
});

const LOW_USAGE_SELF_ACTIONS = new Set([
  "THREE_POINT", "MID_RANGE", "DRIVE", "POST_UP", "CREATE_SEPARATION",
]);

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function resolveBattleTendency(profile) {
  return normalizeTendencyProfile(profile ?? DEFAULT_TENDENCY_PROFILE);
}

function resolvedProfile(profile) {
  return profile?.schemaVersion === DEFAULT_TENDENCY_PROFILE.schemaVersion &&
      Object.isFrozen(profile)
    ? profile
    : resolveBattleTendency(profile);
}

export function getTendencyActionMultiplier({
  handlerProfile,
  beneficiaryProfile,
  action,
  handlerIsBeneficiary,
}) {
  const handler = resolvedProfile(handlerProfile);
  const beneficiary = handlerIsBeneficiary
    ? handler
    : resolvedProfile(beneficiaryProfile);
  let multiplier = DECISION_MULTIPLIERS[handler.decision][action] ?? 1;
  multiplier *= SHOT_PROFILE_MULTIPLIERS[beneficiary.shotProfile][action] ?? 1;
  multiplier *= CREATION_ROLE_MULTIPLIERS[handler.creationRole][action] ?? 1;
  if (!handlerIsBeneficiary) {
    multiplier *= CREATION_ROLE_MULTIPLIERS[beneficiary.creationRole][action] ?? 1;
  }
  if (handler.usage === "LOW") {
    if (handlerIsBeneficiary && LOW_USAGE_SELF_ACTIONS.has(action)) {
      multiplier *= 0.72;
    } else if (["PASS", "EXTRA_PASS", "RESET_OFFENSE"].includes(action)) {
      multiplier *= 1.18;
    }
  }
  return clamp(multiplier, 0.60, 1.50);
}
