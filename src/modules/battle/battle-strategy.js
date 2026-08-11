import { getActualCardStat } from "../card/card-stats.js";
import {
  DEFAULT_LINEUP_STRATEGY,
  normalizeLineupStrategy,
} from "../lineup/lineup-strategy.js";

export const BATTLE_STRATEGY_RESOLVER_VERSION = "battle-strategy-v4";

const MINIMUM_ACTION_MULTIPLIER = 0.75;
const MAXIMUM_ACTION_MULTIPLIER = 1.30;

const OFFENSE_ACTION_MULTIPLIERS = Object.freeze({
  BALANCED: Object.freeze({}),
  PACE_SPACE: Object.freeze({
    THREE_POINT: 1.22,
    DRIVE: 1.05,
    DRIVE_AND_KICK: 1.22,
    CREATE_SEPARATION: 1.08,
    PASS: 1.05,
    EXTRA_PASS: 1.16,
    DRIBBLE_HANDOFF: 1.06,
    OFF_BALL_SCREEN: 1.12,
    RELOCATE: 1.18,
    PICK_AND_POP: 1.22,
    POST_UP: 0.88,
  }),
  MOTION: Object.freeze({
    PASS: 1.14,
    CUT: 1.14,
    DRIBBLE_HANDOFF: 1.12,
    OFF_BALL_SCREEN: 1.14,
    RELOCATE: 1.12,
    EXTRA_PASS: 1.14,
    RESET_OFFENSE: 1.05,
    POST_UP: 0.90,
  }),
  PICK_GAME: Object.freeze({
    PICK_AND_ROLL: 1.18,
    PICK_AND_POP: 1.18,
    DRIBBLE_HANDOFF: 1.10,
    PASS: 1.05,
    THREE_POINT: 0.94,
    POST_UP: 0.92,
  }),
  ISO_CREATOR: Object.freeze({
    CREATE_SEPARATION: 1.18,
    DRIVE: 1.14,
    MID_RANGE: 1.12,
    THREE_POINT: 1.08,
    PASS: 0.88,
    OFF_BALL_SCREEN: 0.88,
  }),
  RIM_PRESSURE: Object.freeze({
    CREATE_SEPARATION: 1.08,
    DRIVE: 1.18,
    CUT: 1.14,
    FAST_BREAK: 1.14,
    PICK_AND_ROLL: 1.08,
    THREE_POINT: 0.86,
    MID_RANGE: 0.92,
  }),
  POST_HUB: Object.freeze({
    POST_UP: 1.20,
    POST_KICK_OUT: 1.16,
    CUT: 1.08,
    RESET_OFFENSE: 1.08,
    FAST_BREAK: 0.84,
    THREE_POINT: 0.92,
  }),
  TRANSITION: Object.freeze({
    FAST_BREAK: 1.24,
    PASS: 1.08,
    CUT: 1.10,
    DRIVE: 1.10,
    RESET_OFFENSE: 0.84,
    POST_UP: 0.84,
  }),
});

const TEMPO_ACTION_MULTIPLIERS = Object.freeze({
  PATIENT: Object.freeze({
    PASS: 1.08,
    RESET_OFFENSE: 1.16,
    POST_UP: 1.08,
    PICK_AND_ROLL: 1.06,
    FAST_BREAK: 0.82,
  }),
  STANDARD: Object.freeze({}),
  QUICK: Object.freeze({
    FAST_BREAK: 1.18,
    DRIVE: 1.06,
    CUT: 1.06,
    PASS: 1.04,
    RESET_OFFENSE: 0.82,
    POST_UP: 0.90,
  }),
});

const SCREEN_ACTIONS = new Set([
  "PICK_AND_ROLL",
  "PICK_AND_POP",
  "DRIBBLE_HANDOFF",
  "OFF_BALL_SCREEN",
]);

const RIM_ACTIONS = new Set([
  "DRIVE",
  "CUT",
  "FAST_BREAK",
  "SECOND_CHANCE",
  "POST_UP",
]);

const DEFENSE_COVERAGE_WEIGHTS = Object.freeze({
  BALANCED: Object.freeze({
    screen: Object.freeze({ FIGHT_OVER: 4, DROP: 3, SWITCH: 2, HEDGE: 1 }),
    rim: Object.freeze({ HELP_RIM: 4, STAY_HOME: 2, ROTATE: 2 }),
    post: Object.freeze({ STAY_HOME: 3, DOUBLE_POST: 2, HELP_RIM: 2 }),
    perimeter: Object.freeze({ STAY_HOME: 4, RECOVER: 3 }),
  }),
  SWITCH: Object.freeze({
    screen: Object.freeze({ SWITCH: 9, FIGHT_OVER: 1 }),
    rim: Object.freeze({ STAY_HOME: 6, HELP_RIM: 2 }),
    post: Object.freeze({ STAY_HOME: 5, DOUBLE_POST: 2 }),
    perimeter: Object.freeze({ STAY_HOME: 7, RECOVER: 2 }),
  }),
  DROP: Object.freeze({
    screen: Object.freeze({ DROP: 9, FIGHT_OVER: 1 }),
    rim: Object.freeze({ HELP_RIM: 8, ROTATE: 2 }),
    post: Object.freeze({ HELP_RIM: 7, DOUBLE_POST: 2 }),
    perimeter: Object.freeze({ RECOVER: 6, STAY_HOME: 3 }),
  }),
  BLITZ: Object.freeze({
    screen: Object.freeze({ BLITZ: 9, HEDGE: 1 }),
    rim: Object.freeze({ BLITZ: 7, ROTATE: 3 }),
    post: Object.freeze({ DOUBLE_POST: 8, ROTATE: 2 }),
    perimeter: Object.freeze({ BLITZ: 7, RECOVER: 3 }),
  }),
  GO_UNDER: Object.freeze({
    screen: Object.freeze({ GO_UNDER: 9, DROP: 1 }),
    rim: Object.freeze({ HELP_RIM: 7, STAY_HOME: 3 }),
    post: Object.freeze({ HELP_RIM: 6, STAY_HOME: 3 }),
    perimeter: Object.freeze({ STAY_HOME: 7, RECOVER: 3 }),
  }),
  STAY_HOME: Object.freeze({
    screen: Object.freeze({ STAY_HOME: 7, FIGHT_OVER: 3 }),
    rim: Object.freeze({ STAY_HOME: 9, HELP_RIM: 1 }),
    post: Object.freeze({ STAY_HOME: 9, DOUBLE_POST: 1 }),
    perimeter: Object.freeze({ STAY_HOME: 9, RECOVER: 1 }),
  }),
  PACK_PAINT: Object.freeze({
    screen: Object.freeze({ DROP: 6, GO_UNDER: 3, HELP_RIM: 1 }),
    rim: Object.freeze({ HELP_RIM: 8, ROTATE: 2 }),
    post: Object.freeze({ DOUBLE_POST: 7, HELP_RIM: 3 }),
    perimeter: Object.freeze({ ROTATE: 7, RECOVER: 3 }),
  }),
});

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function requireSeed(seed, fieldName) {
  if (!Number.isSafeInteger(seed) || seed < 0) {
    throw new TypeError(`${fieldName} must be a non-negative safe integer.`);
  }
  return seed >>> 0;
}

function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function weightedChoice(entries, random) {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = random() * total;
  for (const entry of entries) {
    roll -= entry.weight;
    if (roll <= 0) return entry.value;
  }
  return entries.at(-1).value;
}

function actual(player, field) {
  return getActualCardStat(player?.stats?.[field] ?? 75, player?.cardLevel ?? 5);
}

function average(team, field) {
  return team.reduce((sum, player) => sum + actual(player, field), 0) / team.length;
}

function highest(team, score) {
  return Math.max(...team.map(score));
}

function traitCount(team, codes) {
  return team.reduce((count, player) => count + Number(
    player.traits?.some((trait) => trait.active !== false && codes.includes(trait.traitCode)),
  ), 0);
}

function chooseTopTwo(scores, seed) {
  const entries = Object.entries(scores)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 2)
    .map(([value, score], index) => ({
      value,
      weight: Math.max(1, score - (index === 0 ? 0 : 4)),
    }));
  return weightedChoice(entries, createRandom(seed));
}

function strategyInput(offense, defense, team) {
  const averageStrength = average(team, "strength");
  const averageInterior = average(team, "interiorDefense");
  const tempo = ["PACE_SPACE", "RIM_PRESSURE", "TRANSITION"].includes(offense)
    ? "QUICK"
    : ["PICK_GAME", "ISO_CREATOR", "POST_HUB"].includes(offense)
      ? "PATIENT"
      : "STANDARD";
  const rebounding = ["PACE_SPACE", "TRANSITION"].includes(offense)
    ? "GET_BACK"
    : ["RIM_PRESSURE", "POST_HUB"].includes(offense) &&
        (averageStrength + averageInterior) / 2 >= 76
      ? "CRASH_GLASS"
      : "BALANCED";
  return {
    schemaVersion: DEFAULT_LINEUP_STRATEGY.schemaVersion,
    mainHandler: [...team].sort((left, right) =>
      actual(right, "playmaking") - actual(left, "playmaking") ||
      left.slot.localeCompare(right.slot)
    )[0].slot,
    playerTendencies: {},
    offense,
    tempo,
    defense,
    rebounding,
  };
}

export function deriveBattleSeed(seed, domain) {
  let hash = (0x811c9dc5 ^ requireSeed(seed, "seed")) >>> 0;
  const text = String(domain);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash || 1;
}

export function resolveBattleStrategy(strategy) {
  const value = ["battle-strategy-v2", "battle-strategy-v3", BATTLE_STRATEGY_RESOLVER_VERSION]
    .includes(strategy?.resolverVersion)
    ? Object.fromEntries(Object.entries(strategy).filter(([key]) => key !== "resolverVersion"))
    : strategy;
  const upgradedValue = ["strategy-v1", "strategy-v2", "strategy-v3"].includes(value?.schemaVersion)
    ? {
        schemaVersion: DEFAULT_LINEUP_STRATEGY.schemaVersion,
        mainHandler: value.mainHandler ?? "PG",
        playerTendencies: {},
        offense: value.offense,
        tempo: value.tempo,
        defense: value.defense,
        rebounding: value.rebounding,
      }
    : value;
  const normalized = normalizeLineupStrategy(
    upgradedValue ?? DEFAULT_LINEUP_STRATEGY,
  );
  return Object.freeze({
    ...normalized,
    resolverVersion: BATTLE_STRATEGY_RESOLVER_VERSION,
  });
}

export function getStrategyActionMultiplier(strategy, action) {
  const resolved = resolveBattleStrategy(strategy);
  const offense = OFFENSE_ACTION_MULTIPLIERS[resolved.offense]?.[action] ?? 1;
  const tempo = TEMPO_ACTION_MULTIPLIERS[resolved.tempo]?.[action] ?? 1;
  return clamp(
    offense * tempo,
    MINIMUM_ACTION_MULTIPLIER,
    MAXIMUM_ACTION_MULTIPLIER,
  );
}

export function getStrategyTurnoverDelta(strategy, phase) {
  const resolved = resolveBattleStrategy(strategy);
  if (resolved.tempo === "QUICK") return phase === "TRANSITION" ? 0.005 : 0.01;
  if (resolved.tempo === "PATIENT") return -0.005;
  return 0;
}

export function getStrategyOffensiveReboundDelta(strategy) {
  const resolved = resolveBattleStrategy(strategy);
  if (resolved.rebounding === "CRASH_GLASS") return 0.04;
  if (resolved.rebounding === "GET_BACK") return -0.04;
  return 0;
}

export function getStrategyFastBreakDelta(offenseStrategy, defenseStrategy) {
  const offense = resolveBattleStrategy(offenseStrategy);
  const defense = resolveBattleStrategy(defenseStrategy);
  let delta = offense.tempo === "QUICK" ? 0.08 : offense.tempo === "PATIENT" ? -0.06 : 0;
  if (offense.offense === "TRANSITION") delta += 0.10;
  if (defense.rebounding === "GET_BACK") delta -= 0.10;
  if (defense.rebounding === "CRASH_GLASS") delta += 0.06;
  return clamp(delta, -0.18, 0.18);
}

export function coverageWeightsFor(strategy, action) {
  const resolved = resolveBattleStrategy(strategy);
  const group = action === "POST_UP" || action === "POST_KICK_OUT"
    ? "post"
    : SCREEN_ACTIONS.has(action)
      ? "screen"
      : RIM_ACTIONS.has(action)
        ? "rim"
        : "perimeter";
  return DEFENSE_COVERAGE_WEIGHTS[resolved.defense][group];
}

export function selectAiStrategy({ team, offenseSeed, defenseSeed }) {
  if (!Array.isArray(team) || team.length === 0) {
    throw new TypeError("AI strategy selection requires a non-empty team.");
  }
  const offenseScores = {
    BALANCED: 76,
    PACE_SPACE: (average(team, "threePoint") + average(team, "playmaking")) / 2 +
      traitCount(team, ["PERIMETER_GRAVITY", "CATCH_AND_SHOOT"]) * 2,
    MOTION: average(team, "playmaking") +
      traitCount(team, ["CONNECTOR", "OFF_BALL_MOVER", "CREATIVE_PASSER"]) * 2,
    PICK_GAME: (highest(team, (player) => actual(player, "playmaking")) +
      highest(team, (player) => actual(player, "strength"))) / 2 +
      traitCount(team, ["PICK_ROLL_MAESTRO", "SCREEN_SETTER"]) * 2,
    ISO_CREATOR: highest(team, (player) =>
      (actual(player, "playmaking") + actual(player, "finishing") +
        actual(player, "midRange") + actual(player, "threePoint")) / 4) +
      traitCount(team, ["SEPARATION_ARTIST", "MIDRANGE_ASSASSIN"]) * 2,
    RIM_PRESSURE: (average(team, "finishing") + average(team, "strength")) / 2 +
      traitCount(team, ["PAINT_FINISHER"]) * 2,
    POST_HUB: highest(team, (player) =>
      (actual(player, "finishing") + actual(player, "strength")) / 2) +
      traitCount(team, ["POST_TECHNICIAN"]) * 2,
    TRANSITION: (average(team, "playmaking") + average(team, "perimeterDefense") +
      average(team, "finishing")) / 3 +
      traitCount(team, ["TRANSITION_ENGINE", "ACTIVE_HANDS"]) * 2,
  };
  const defenseScores = {
    BALANCED: 76,
    SWITCH: (average(team, "perimeterDefense") + average(team, "strength")) / 2 +
      traitCount(team, ["SWITCHABLE_DEFENDER", "SCREEN_NAVIGATOR"]) * 2,
    DROP: (average(team, "interiorDefense") + average(team, "strength")) / 2 +
      traitCount(team, ["RIM_PROTECTOR", "GLASS_CLEANER"]) * 2,
    BLITZ: average(team, "perimeterDefense") +
      traitCount(team, ["ACTIVE_HANDS", "POINT_OF_ATTACK_STOPPER"]) * 2,
    GO_UNDER: (average(team, "perimeterDefense") + average(team, "interiorDefense")) / 2,
    STAY_HOME: average(team, "perimeterDefense") +
      traitCount(team, ["POINT_OF_ATTACK_STOPPER", "SCREEN_NAVIGATOR"]) * 2,
    PACK_PAINT: (average(team, "interiorDefense") + average(team, "strength")) / 2 +
      traitCount(team, ["RIM_PROTECTOR"]) * 2,
  };

  const offense = chooseTopTwo(offenseScores, requireSeed(offenseSeed, "offenseSeed"));
  const defense = chooseTopTwo(defenseScores, requireSeed(defenseSeed, "defenseSeed"));
  return resolveBattleStrategy(strategyInput(offense, defense, team));
}

export { MAXIMUM_ACTION_MULTIPLIER, MINIMUM_ACTION_MULTIPLIER };
