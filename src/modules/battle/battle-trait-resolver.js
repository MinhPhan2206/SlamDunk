export const BATTLE_TRAIT_RESOLVER_VERSION = "battle-traits-v2";

export const APPROVED_BATTLE_TRAIT_CODES = Object.freeze([
  "PERIMETER_GRAVITY",
  "RANGE_EXTENDER",
  "MIDRANGE_ASSASSIN",
  "PAINT_FINISHER",
  "CATCH_AND_SHOOT",
  "POST_TECHNICIAN",
  "SEPARATION_ARTIST",
  "FLOOR_GENERAL",
  "PICK_ROLL_MAESTRO",
  "CREATIVE_PASSER",
  "CONNECTOR",
  "SCREEN_SETTER",
  "OFF_BALL_MOVER",
  "POINT_OF_ATTACK_STOPPER",
  "SWITCHABLE_DEFENDER",
  "SCREEN_NAVIGATOR",
  "RIM_PROTECTOR",
  "ACTIVE_HANDS",
  "GLASS_CLEANER",
  "TRANSITION_ENGINE",
  "TOUGH_SHOT_MAKER",
  "CONTACT_FINISHER",
  "CLUTCH_PERFORMER",
  "CLUTCH_DEFENDER",
  "COMEBACK_CATALYST",
  "MOMENTUM_SCORER",
  "COLD_BLOODED",
]);

const RIM_ACTIONS = new Set([
  "DRIVE",
  "CUT",
  "FAST_BREAK",
  "PICK_AND_ROLL",
  "SECOND_CHANCE",
  "POST_UP",
]);
const PAINT_FINISHER_ACTIONS = new Set([
  "DRIVE",
  "CUT",
  "FAST_BREAK",
  "PICK_AND_ROLL",
  "SECOND_CHANCE",
]);
const SCREEN_ACTIONS = new Set([
  "PICK_AND_ROLL",
  "PICK_AND_POP",
  "DRIBBLE_HANDOFF",
  "OFF_BALL_SCREEN",
]);
const PASS_ACTIONS = new Set([
  "PASS",
  "CUT",
  "DRIVE_AND_KICK",
  "POST_KICK_OUT",
  "EXTRA_PASS",
]);

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function tierValue(trait, values) {
  return values[clamp(Number(trait.traitTier) || 1, 1, 3) - 1];
}

function findTrait(player, traitCode) {
  return player?.traits?.find((trait) =>
    trait.active !== false && trait.traitCode === traitCode
  ) ?? null;
}

function strongestTrait(players, traitCode) {
  let selected = null;
  for (const player of players ?? []) {
    const trait = findTrait(player, traitCode);
    if (trait && (!selected || trait.traitTier > selected.trait.traitTier)) {
      selected = { player, trait };
    }
  }
  return selected;
}

function ownedTrait(player, traitCode) {
  const trait = findTrait(player, traitCode);
  return trait ? { player, trait } : null;
}

function emptyResult() {
  return {
    scoreDelta: 0,
    qualityDelta: 0,
    probabilityDelta: 0,
    blockProbabilityDelta: 0,
    mismatchPenaltyReduction: 0,
    weightMultiplier: 1,
    activations: [],
  };
}

function activation(result, source, hook, channel, value) {
  if (!source || value === 0 || value === 1) return;
  result.activations.push(Object.freeze({
    traitCode: source.trait.traitCode,
    traitTier: source.trait.traitTier,
    hook,
    channel,
    value,
    player: Object.freeze({
      cardTemplateId: source.player?.cardTemplateId ?? null,
      cardInstanceId: source.player?.cardInstanceId ?? null,
      cardName: source.player?.cardName ?? null,
      slot: source.player?.slot ?? null,
    }),
  }));
}

function addScore(result, source, hook, value, channel = "SCORE_DELTA") {
  if (!source) return;
  result.scoreDelta += value;
  activation(result, source, hook, channel, value);
}

function addQuality(result, source, hook, value, channel) {
  if (!source) return;
  result.qualityDelta += value;
  activation(result, source, hook, channel, value);
}

function addProbability(result, source, hook, value, channel) {
  if (!source) return;
  result.probabilityDelta += value;
  activation(result, source, hook, channel, value);
}

function addBlockProbability(result, source, hook, value) {
  if (!source) return;
  result.blockProbabilityDelta += value;
  activation(result, source, hook, "BLOCK_PROBABILITY_DELTA", value);
}

function addMultiplier(result, source, hook, value, channel = "ACTION_WEIGHT") {
  if (!source) return;
  result.weightMultiplier *= value;
  activation(result, source, hook, channel, value);
}

function resolveActionSelection(result, context) {
  const actor = context.beneficiary ?? context.actor ?? context.handler;
  if (PAINT_FINISHER_ACTIONS.has(context.action)) {
    const source = ownedTrait(actor, "PAINT_FINISHER");
    if (source) addMultiplier(
      result, source, "ACTION_SELECTION",
      tierValue(source.trait, [1.05, 1.10, 1.15]),
    );
  }
  if (["PASS", "RESET_OFFENSE", "EXTRA_PASS", "PICK_AND_ROLL"].includes(context.action)) {
    const source = strongestTrait(context.offense, "FLOOR_GENERAL");
    if (source) addScore(
      result, source, "ACTION_SELECTION",
      tierValue(source.trait, [2, 4, 6]), "DECISION_SCORE_DELTA",
    );
  }
  if (["CUT", "DRIVE_AND_KICK", "POST_KICK_OUT", "EXTRA_PASS"].includes(context.action)) {
    const source = ownedTrait(context.handler, "CREATIVE_PASSER");
    if (source) addMultiplier(
      result, source, "ACTION_SELECTION",
      tierValue(source.trait, [1.05, 1.10, 1.15]), "PASS_ACTION_WEIGHT",
    );
  }
  if (["EXTRA_PASS", "RESET_OFFENSE"].includes(context.action)) {
    const source = ownedTrait(actor, "CONNECTOR");
    if (source) addMultiplier(
      result, source, "ACTION_SELECTION",
      tierValue(source.trait, [1.08, 1.16, 1.24]), "CONTINUATION_ACTION_WEIGHT",
    );
  }
  if (["CUT", "OFF_BALL_SCREEN", "RELOCATE"].includes(context.action)) {
    const source = ownedTrait(actor, "OFF_BALL_MOVER");
    if (source) addMultiplier(
      result, source, "ACTION_SELECTION",
      tierValue(source.trait, [1.05, 1.10, 1.15]), "OFF_BALL_ACTION_WEIGHT",
    );
  }
}

function resolveAdvantage(result, context) {
  if (["PASS", "CUT", "DRIVE", "POST_KICK_OUT"].includes(context.action)) {
    const candidates = (context.offense ?? []).filter((player) => player !== context.handler);
    const source = strongestTrait(candidates, "PERIMETER_GRAVITY");
    if (source) addScore(
      result, source, "ADVANTAGE_CREATION",
      tierValue(source.trait, [2, 4, 6]), "TEAM_SPACING_SCORE",
    );
  }
  if (["POST_UP", "POST_KICK_OUT"].includes(context.action)) {
    const source = ownedTrait(context.handler, "POST_TECHNICIAN");
    if (source) addScore(
      result, source, "ADVANTAGE_CREATION",
      tierValue(source.trait, [2, 4, 6]), "CREATION_SCORE_DELTA",
    );
  }
  if (["CREATE_SEPARATION", "DRIVE", "MID_RANGE", "THREE_POINT"].includes(context.action)) {
    const source = ownedTrait(context.handler, "SEPARATION_ARTIST");
    if (source) addScore(
      result, source, "ADVANTAGE_CREATION",
      tierValue(source.trait, [2, 4, 6]), "CREATION_SCORE_DELTA",
    );
  }
  if (SCREEN_ACTIONS.has(context.action)) {
    const maestro = ownedTrait(context.handler, "PICK_ROLL_MAESTRO");
    if (maestro) addScore(
      result, maestro, "ADVANTAGE_CREATION",
      tierValue(maestro.trait, [2, 4, 6]), "SCREEN_READ_SCORE_DELTA",
    );
    const setter = ownedTrait(context.screener, "SCREEN_SETTER");
    if (setter) addScore(
      result, setter, "ADVANTAGE_CREATION",
      tierValue(setter.trait, [2, 4, 6]), "SCREEN_ADVANTAGE_SCORE",
    );
  }
  if (["CUT", "OFF_BALL_SCREEN", "RELOCATE"].includes(context.action)) {
    const source = ownedTrait(context.beneficiary, "OFF_BALL_MOVER");
    if (source) addScore(
      result, source, "ADVANTAGE_CREATION",
      tierValue(source.trait, [2, 4, 6]), "CREATION_SCORE_DELTA",
    );
  }
  if (["CREATE_SEPARATION", "DRIVE", "DRIBBLE_HANDOFF"].includes(context.action)) {
    const source = ownedTrait(context.defender, "POINT_OF_ATTACK_STOPPER");
    if (source) addScore(
      result, source, "ADVANTAGE_CREATION",
      -tierValue(source.trait, [2, 4, 6]), "OPPONENT_CREATION_SCORE_DELTA",
    );
  }
}

function resolveDefensiveResponse(result, context) {
  if (context.coverage === "SWITCH") {
    const source = ownedTrait(context.defender, "SWITCHABLE_DEFENDER");
    if (source) {
      const value = tierValue(source.trait, [2, 4, 6]);
      result.mismatchPenaltyReduction += value;
      activation(result, source, "DEFENSIVE_RESPONSE", "MISMATCH_PENALTY_REDUCTION", value);
    }
  }
  if (SCREEN_ACTIONS.has(context.action)) {
    const source = ownedTrait(context.onBallDefender ?? context.defender, "SCREEN_NAVIGATOR");
    if (source) addScore(
      result, source, "DEFENSIVE_RESPONSE",
      -tierValue(source.trait, [2, 4, 6]), "SCREEN_ADVANTAGE_SCORE_DELTA",
    );
  }
}

function resolvePass(result, context) {
  if (["PICK_AND_ROLL", "PICK_AND_POP"].includes(context.action)) {
    const source = ownedTrait(context.passer, "PICK_ROLL_MAESTRO");
    if (source) addProbability(
      result, source, "PASS_RESOLUTION",
      tierValue(source.trait, [0.01, 0.02, 0.03]), "PASS_SUCCESS_PROBABILITY_DELTA",
    );
  }
  if (PASS_ACTIONS.has(context.action) && context.difficultPass !== false) {
    const source = ownedTrait(context.passer, "CREATIVE_PASSER");
    if (source) addProbability(
      result, source, "PASS_RESOLUTION",
      tierValue(source.trait, [0.01, 0.02, 0.03]), "PASS_SUCCESS_PROBABILITY_DELTA",
    );
  }
}

function resolveTurnover(result, context) {
  if (["POST_UP", "POST_KICK_OUT"].includes(context.action)) {
    const source = ownedTrait(context.handler, "POST_TECHNICIAN");
    if (source) addProbability(
      result, source, "TURNOVER",
      -tierValue(source.trait, [0.005, 0.01, 0.015]), "TURNOVER_PROBABILITY_DELTA",
    );
  }
  if (["PASS", "HANDLE"].includes(context.turnoverType)) {
    const source = strongestTrait(context.offense, "FLOOR_GENERAL");
    if (source) addProbability(
      result, source, "TURNOVER",
      -tierValue(source.trait, [0.005, 0.01, 0.015]), "TURNOVER_PROBABILITY_DELTA",
    );
  }
  if (["PASS", "HANDLE"].includes(context.turnoverType)) {
    const source = ownedTrait(context.defender, "ACTIVE_HANDS");
    if (source) addProbability(
      result, source, "TURNOVER",
      tierValue(source.trait, [0.005, 0.01, 0.015]), "TURNOVER_PROBABILITY_DELTA",
    );
  }
  if (context.isClutch) {
    const performer = ownedTrait(context.handler, "CLUTCH_PERFORMER");
    if (performer) addProbability(
      result, performer, "TURNOVER",
      -tierValue(performer.trait, [0.005, 0.01, 0.015]),
      "CLUTCH_TURNOVER_PROBABILITY_DELTA",
    );
    const defender = ownedTrait(context.defender, "CLUTCH_DEFENDER");
    if (defender) addProbability(
      result, defender, "TURNOVER",
      tierValue(defender.trait, [0.005, 0.01, 0.015]),
      "CLUTCH_TURNOVER_PROBABILITY_DELTA",
    );
  }
}

function resolveShotQuality(result, context) {
  if (context.shotType === "THREE_POINT" && context.deepRange) {
    const source = ownedTrait(context.shooter, "RANGE_EXTENDER");
    if (source) addQuality(
      result, source, "SHOT_QUALITY",
      tierValue(source.trait, [1.5, 3, 4.5]), "DISTANCE_PENALTY_REDUCTION",
    );
  }
  if (
    context.shotType === "MID_RANGE" && context.shotQuality !== "OPEN" &&
    ["MID_RANGE", "CREATE_SEPARATION"].includes(context.action)
  ) {
    const source = ownedTrait(context.shooter, "MIDRANGE_ASSASSIN");
    if (source) addQuality(
      result, source, "SHOT_QUALITY",
      tierValue(source.trait, [1.5, 3, 4.5]), "CONTEST_PENALTY_REDUCTION",
    );
  }
  if (
    context.shotType === "FINISHING" && context.contact &&
    PAINT_FINISHER_ACTIONS.has(context.action)
  ) {
    const source = ownedTrait(context.shooter, "PAINT_FINISHER");
    if (source) addQuality(
      result, source, "SHOT_QUALITY",
      tierValue(source.trait, [2, 4, 6]), "CONTACT_PENALTY_REDUCTION",
    );
  }
  if (context.catchAndShoot) {
    const source = ownedTrait(context.shooter, "CATCH_AND_SHOOT");
    if (source) addQuality(
      result, source, "SHOT_QUALITY",
      tierValue(source.trait, [2, 4, 6]), "SHOT_QUALITY_DELTA",
    );
  }
}

function resolveRimDefense(result, context) {
  if (context.shotType !== "FINISHING" || !RIM_ACTIONS.has(context.action)) return;
  const source = strongestTrait(
    [context.defender, context.helper].filter(Boolean),
    "RIM_PROTECTOR",
  );
  if (!source) return;
  addScore(
    result, source, "RIM_DEFENSE",
    -tierValue(source.trait, [2, 4, 6]), "CONTEST_SCORE_DELTA",
  );
  addBlockProbability(
    result, source, "RIM_DEFENSE",
    tierValue(source.trait, [0.005, 0.01, 0.015]),
  );
}

function resolveRebound(result, context) {
  const source = ownedTrait(context.rebounder ?? context.actor, "GLASS_CLEANER");
  if (source) addProbability(
    result, source, "REBOUND",
    tierValue(source.trait, [0.02, 0.04, 0.06]), "REBOUND_PROBABILITY_DELTA",
  );
}

function resolveTransition(result, context) {
  if (context.action === "FAST_BREAK") {
    const source = strongestTrait(context.offense, "TRANSITION_ENGINE");
    if (source) addProbability(
      result, source, "POSSESSION_TRANSITION",
      tierValue(source.trait, [0.02, 0.04, 0.06]), "FAST_BREAK_PROBABILITY_DELTA",
    );
  }
  if (["SECOND_CHANCE", "RESET_OFFENSE"].includes(context.action)) {
    const source = ownedTrait(context.rebounder, "GLASS_CLEANER");
    if (source) addMultiplier(
      result, source, "POSSESSION_TRANSITION",
      tierValue(source.trait, [1.05, 1.10, 1.15]), "SECOND_CHANCE_ACTION_WEIGHT",
    );
  }
}

function resolveShotMake(result, context) {
  if (
    ["THREE_POINT", "MID_RANGE"].includes(context.shotType) &&
    ["CONTESTED", "HEAVILY_CONTESTED"].includes(context.shotQuality)
  ) {
    const source = ownedTrait(context.shooter, "TOUGH_SHOT_MAKER");
    if (source) addProbability(
      result, source, "SHOT_MAKE",
      tierValue(source.trait, [0.01, 0.02, 0.03]),
      "CONTESTED_SHOT_PROBABILITY_DELTA",
    );
  }
  if (context.shotType === "FINISHING" && context.contact) {
    const source = ownedTrait(context.shooter, "CONTACT_FINISHER");
    if (source) addProbability(
      result, source, "SHOT_MAKE",
      tierValue(source.trait, [0.01, 0.02, 0.03]),
      "CONTACT_FINISH_PROBABILITY_DELTA",
    );
  }
  if (context.isClutch) {
    const performer = ownedTrait(context.shooter, "CLUTCH_PERFORMER");
    if (performer) addProbability(
      result, performer, "SHOT_MAKE",
      tierValue(performer.trait, [0.005, 0.01, 0.015]),
      "CLUTCH_SHOT_PROBABILITY_DELTA",
    );
    const defender = ownedTrait(context.defender, "CLUTCH_DEFENDER");
    if (defender) addProbability(
      result, defender, "SHOT_MAKE",
      -tierValue(defender.trait, [0.005, 0.01, 0.015]),
      "CLUTCH_CONTEST_PROBABILITY_DELTA",
    );
  }
  if (context.isComeback) {
    const source = ownedTrait(context.shooter, "COMEBACK_CATALYST");
    if (source) addProbability(
      result, source, "SHOT_MAKE",
      tierValue(source.trait, [0.005, 0.01, 0.015]),
      "COMEBACK_SHOT_PROBABILITY_DELTA",
    );
  }
  if (context.scoringStreak >= 2) {
    const source = ownedTrait(context.shooter, "MOMENTUM_SCORER");
    if (source) addProbability(
      result, source, "SHOT_MAKE",
      tierValue(source.trait, [0.005, 0.01, 0.015]),
      "MOMENTUM_SHOT_PROBABILITY_DELTA",
    );
  }
  if (context.isGameWinningAttempt) {
    const source = ownedTrait(context.shooter, "COLD_BLOODED");
    if (source) addProbability(
      result, source, "SHOT_MAKE",
      tierValue(source.trait, [0.01, 0.02, 0.03]),
      "GAME_WINNING_SHOT_PROBABILITY_DELTA",
    );
  }
}

export function resolveBattleTraitModifiers(hook, context = {}) {
  const result = emptyResult();
  if (hook === "ACTION_SELECTION") resolveActionSelection(result, context);
  else if (hook === "ADVANTAGE_CREATION") resolveAdvantage(result, context);
  else if (hook === "DEFENSIVE_RESPONSE") resolveDefensiveResponse(result, context);
  else if (hook === "PASS_RESOLUTION") resolvePass(result, context);
  else if (hook === "TURNOVER") resolveTurnover(result, context);
  else if (hook === "SHOT_QUALITY") resolveShotQuality(result, context);
  else if (hook === "RIM_DEFENSE") resolveRimDefense(result, context);
  else if (hook === "REBOUND") resolveRebound(result, context);
  else if (hook === "POSSESSION_TRANSITION") resolveTransition(result, context);
  else if (hook === "SHOT_MAKE") resolveShotMake(result, context);
  else {
    throw new TypeError(`Unsupported Battle Trait hook: ${hook}.`);
  }

  return Object.freeze({
    scoreDelta: clamp(result.scoreDelta, -8, 8),
    qualityDelta: clamp(result.qualityDelta, -8, 8),
    probabilityDelta: clamp(result.probabilityDelta, -0.08, 0.08),
    blockProbabilityDelta: clamp(result.blockProbabilityDelta, 0, 0.02),
    mismatchPenaltyReduction: clamp(result.mismatchPenaltyReduction, 0, 6),
    weightMultiplier: clamp(result.weightMultiplier, 0.75, 1.30),
    activations: Object.freeze(result.activations),
  });
}
