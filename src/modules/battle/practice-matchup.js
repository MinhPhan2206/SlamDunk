import {
  CARD_STAT_FIELDS,
  getActualCardStats,
} from "../card/index.js";
import { BattleError } from "./battle.errors.js";

const SLOTS = Object.freeze(["PG", "SG", "SF", "PF", "C"]);
const TRAIT_WEIGHTS = Object.freeze({
  RANGE_EXTENDER: 0.16,
  CATCH_AND_SHOOT: 0.15,
  RIM_PROTECTOR: 0.15,
  PAINT_FINISHER: 0.14,
  MIDRANGE_ASSASSIN: 0.13,
  ACTIVE_HANDS: 0.13,
  FLOOR_GENERAL: 0.13,
  PICK_ROLL_MAESTRO: 0.12,
  POINT_OF_ATTACK_STOPPER: 0.12,
  GLASS_CLEANER: 0.12,
  CONTACT_FINISHER: 0.12,
  PERIMETER_GRAVITY: 0.11,
  SEPARATION_ARTIST: 0.11,
  CREATIVE_PASSER: 0.10,
  POST_TECHNICIAN: 0.10,
  SCREEN_NAVIGATOR: 0.10,
  SWITCHABLE_DEFENDER: 0.10,
  TRANSITION_ENGINE: 0.10,
  TOUGH_SHOT_MAKER: 0.10,
  CLUTCH_PERFORMER: 0.09,
  CLUTCH_DEFENDER: 0.09,
  OFF_BALL_MOVER: 0.08,
  CONNECTOR: 0.08,
  SCREEN_SETTER: 0.08,
  COMEBACK_CATALYST: 0.07,
  MOMENTUM_SCORER: 0.07,
  COLD_BLOODED: 0.07,
});

function seededRandom(seed) {
  let state = (seed ^ 0x9e3779b9) >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function traitImpact(traits = []) {
  return traits.reduce((total, trait) => total +
    (TRAIT_WEIGHTS[trait.traitCode] ?? 0.08) * Number(trait.traitTier ?? 1), 0);
}

function cardStatPower(stats, cardLevel, statAdjustment = 0) {
  const actual = getActualCardStats(stats, cardLevel);
  return CARD_STAT_FIELDS.reduce((total, field) =>
    total + Math.max(0, actual[field] + statAdjustment), 0
  ) / CARD_STAT_FIELDS.length;
}

function cardPower({ stats, cardLevel, traits }, statAdjustment = 0) {
  return cardStatPower(stats, cardLevel, statAdjustment) + traitImpact(traits);
}

export function calculatePracticeTeamPower(team) {
  if (!Array.isArray(team) || team.length !== SLOTS.length) {
    throw new TypeError("Practice Team Power requires five players.");
  }
  return team.reduce((total, player) => total + cardPower(player), 0) / team.length;
}

function validateConfig(config, bracketCode) {
  if (!Number.isSafeInteger(config?.candidatePoolSize) || config.candidatePoolSize < 5) {
    throw new TypeError("practice.candidatePoolSize must be at least five.");
  }
  if (!Number.isSafeInteger(config?.beamWidth) || config.beamWidth < 5) {
    throw new TypeError("practice.beamWidth must be at least five.");
  }
  const rule = config.bracketRules?.find((entry) => entry.code === bracketCode);
  if (!rule) {
    throw new BattleError("BATTLE_BRACKET_INVALID", "Choose a valid Practice bracket.");
  }
  return rule;
}

function aiLevelFor(playerTeam, rule) {
  if (rule.fixedAiLevel) return rule.fixedAiLevel;
  const averageLevel = playerTeam.reduce(
    (total, player) => total + player.cardLevel,
    0,
  ) / playerTeam.length;
  return Math.min(
    rule.maximumAiLevel,
    Math.max(rule.minimumAiLevel, Math.round(averageLevel) + rule.aiLevelDelta),
  );
}

function streetOffset(config, playerPower) {
  const band = config.streetPowerBands.find((entry) =>
    playerPower <= entry.maximumPower
  );
  return band?.powerOffset ?? config.streetPowerBands.at(-1).powerOffset;
}

function finalScore(state, targetPower, maximumTraitImpact) {
  const power = state.powerTotal / SLOTS.length;
  const traitOverflow = Math.max(0, state.traitImpact - maximumTraitImpact);
  return Math.abs(power - targetPower) + traitOverflow * 2;
}

export function selectPracticeAiMatchup({
  templates,
  playerTeam,
  seed,
  bracketCode,
  config,
}) {
  if (!Array.isArray(templates) || !Array.isArray(playerTeam)) {
    throw new TypeError("Practice matchup requires templates and a Player lineup.");
  }
  if (!Number.isSafeInteger(seed) || seed <= 0) {
    throw new TypeError("Practice matchup seed must be a positive safe integer.");
  }
  const rule = validateConfig(config, bracketCode);
  const random = seededRandom(seed);
  const playerPower = calculatePracticeTeamPower(playerTeam);
  const playerTraitImpact = playerTeam.reduce(
    (total, player) => total + traitImpact(player.traits),
    0,
  );
  const rookieProtected = bracketCode === "street" &&
    playerPower <= config.rookiePowerThreshold;
  const statAdjustment = rookieProtected ? config.rookieAiStatAdjustment : 0;
  const powerOffset = bracketCode === "street"
    ? streetOffset(config, playerPower)
    : rule.powerOffset;
  const targetPower = playerPower + powerOffset;
  const aiLevel = aiLevelFor(playerTeam, rule);
  const maximumTraitImpact = playerTraitImpact *
    rule.traitCapBasisPoints / 10_000;
  const eligibleTemplates = rookieProtected
    ? templates.filter((template) => template.rarityCode === "BASE")
    : templates;
  let states = [{
    selections: [],
    usedNames: new Set(),
    powerTotal: 0,
    traitImpact: 0,
    tieBreaker: random(),
  }];

  for (const slot of SLOTS) {
    const slotCandidates = eligibleTemplates
      .filter((template) =>
        [template.primaryPosition, template.secondaryPosition].includes(slot)
      )
      .map((template) => {
        const traits = template.traits ?? [];
        return {
          template,
          traits,
          cardLevel: aiLevel,
          power: cardPower({ stats: template, cardLevel: aiLevel, traits }, statAdjustment),
          traitImpact: traitImpact(traits),
        };
      })
      .sort((left, right) =>
        Math.abs(left.power - targetPower) - Math.abs(right.power - targetPower)
      )
      .slice(0, config.candidatePoolSize);
    if (slotCandidates.length === 0) {
      throw new BattleError(
        "AI_LINEUP_UNAVAILABLE",
        `The Practice catalog cannot fill the AI ${slot} slot.`,
      );
    }

    const nextStates = [];
    for (const state of states) {
      for (const candidate of slotCandidates) {
        const playerKey = candidate.template.playerName.trim().toLowerCase();
        if (state.usedNames.has(playerKey)) continue;
        const usedNames = new Set(state.usedNames);
        usedNames.add(playerKey);
        const selections = [...state.selections, Object.freeze({
          slot,
          template: candidate.template,
          traits: Object.freeze([...candidate.traits]),
          cardLevel: candidate.cardLevel,
          statAdjustment,
        })];
        nextStates.push({
          selections,
          usedNames,
          powerTotal: state.powerTotal + candidate.power,
          traitImpact: state.traitImpact + candidate.traitImpact,
          tieBreaker: random(),
        });
      }
    }
    nextStates.sort((left, right) => {
      const completedSlots = left.selections.length;
      const leftPower = left.powerTotal / completedSlots;
      const rightPower = right.powerTotal / completedSlots;
      return Math.abs(leftPower - targetPower) - Math.abs(rightPower - targetPower) ||
        left.tieBreaker - right.tieBreaker;
    });
    states = nextStates.slice(0, config.beamWidth);
  }

  if (states.length === 0) {
    throw new BattleError(
      "AI_LINEUP_UNAVAILABLE",
      "The Practice catalog cannot create a legal AI lineup.",
    );
  }
  states.sort((left, right) =>
    finalScore(left, targetPower, maximumTraitImpact) -
      finalScore(right, targetPower, maximumTraitImpact) ||
    left.tieBreaker - right.tieBreaker
  );
  const finalists = states.slice(0, Math.min(5, states.length));
  const selected = finalists[Math.floor(random() * finalists.length)];
  return Object.freeze({
    lineup: Object.freeze(selected.selections),
    metadata: Object.freeze({
      bracketCode,
      playerPower,
      targetPower,
      aiPower: selected.powerTotal / SLOTS.length,
      aiLevel,
      statAdjustment,
      balancedAi: rule.balancedAi,
    }),
  });
}
