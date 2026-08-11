import {
  CARD_STAT_FIELDS,
  getActualCardStats,
} from "../card/index.js";
import { BattleError } from "./battle.errors.js";

const SLOTS = Object.freeze(["PG", "SG", "SF", "PF", "C"]);

function createSeededRandom(seed) {
  let state = (seed ^ 0x9e3779b9) >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function strength(stats, cardLevel) {
  const actual = getActualCardStats(stats, cardLevel);
  return CARD_STAT_FIELDS.reduce((sum, field) => sum + actual[field], 0) /
    CARD_STAT_FIELDS.length;
}

function templateIdOrder(left, right) {
  const leftId = BigInt(left.template.cardTemplateId);
  const rightId = BigInt(right.template.cardTemplateId);
  return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
}

function chooseWeighted(candidates, random) {
  const weights = candidates.map((candidate) =>
    Math.max(0.0001, Math.exp(-candidate.distance / 4))
  );
  let roll = random() * weights.reduce((sum, weight) => sum + weight, 0);
  for (let index = 0; index < candidates.length; index += 1) {
    roll -= weights[index];
    if (roll <= 0) return candidates[index];
  }
  return candidates.at(-1);
}

export function selectAiMatchup({
  templates,
  playerTeam,
  seed,
  candidatePoolSize,
  ratingTolerance,
  ratingOffset = 0,
}) {
  if (!Array.isArray(templates) || !Array.isArray(playerTeam)) {
    throw new TypeError("AI matchup requires Card templates and a Player lineup.");
  }
  if (!Number.isSafeInteger(seed) || seed <= 0) {
    throw new TypeError("AI matchup seed must be a positive safe integer.");
  }
  if (!Number.isFinite(ratingOffset)) {
    throw new TypeError("AI matchup rating offset must be a finite number.");
  }
  const random = createSeededRandom(seed);
  const usedTemplateIds = new Set();
  const usedPlayerNames = new Set();

  return Object.freeze(SLOTS.map((slot) => {
    const opponent = playerTeam.find((player) => player.slot === slot);
    if (!opponent) {
      throw new BattleError(
        "PLAYER_LINEUP_INVALID",
        `The Player lineup is missing the ${slot} slot.`,
      );
    }
    const target = strength(opponent.stats, opponent.cardLevel) + ratingOffset;
    const eligible = templates
      .filter((template) =>
        !usedTemplateIds.has(template.cardTemplateId) &&
        !usedPlayerNames.has(template.playerName.trim().toLowerCase()) &&
        [template.primaryPosition, template.secondaryPosition].includes(slot)
      )
      .map((template) => ({
        template,
        distance: Math.abs(strength(template, opponent.cardLevel) - target),
      }))
      .sort((left, right) =>
        left.distance - right.distance || templateIdOrder(left, right)
      );
    if (eligible.length === 0) {
      throw new BattleError(
        "AI_LINEUP_UNAVAILABLE",
        `The Card catalog cannot fill the AI ${slot} slot.`,
      );
    }

    const closeCandidates = eligible
      .filter((candidate) => candidate.distance <= ratingTolerance)
      .slice(0, candidatePoolSize);
    const pool = closeCandidates.length >= 2
      ? closeCandidates
      : eligible.slice(0, Math.min(candidatePoolSize, Math.max(2, eligible.length)));
    const selected = chooseWeighted(pool, random);
    usedTemplateIds.add(selected.template.cardTemplateId);
    usedPlayerNames.add(selected.template.playerName.trim().toLowerCase());
    return Object.freeze({
      slot,
      template: selected.template,
      cardLevel: opponent.cardLevel,
    });
  }));
}
