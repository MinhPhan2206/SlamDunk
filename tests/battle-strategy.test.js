import assert from "node:assert/strict";
import test from "node:test";

import {
  BATTLE_STRATEGY_RESOLVER_VERSION,
  deriveBattleSeed,
  getStrategyActionMultiplier,
  resolveBattleStrategy,
  selectAiStrategy,
} from "../src/modules/battle/battle-strategy.js";
import { DEFAULT_LINEUP_STRATEGY } from "../src/modules/lineup/lineup-strategy.js";

const SLOTS = ["PG", "SG", "SF", "PF", "C"];

function team() {
  return SLOTS.map((slot, index) => ({
    slot,
    cardTemplateId: String(index + 1),
    cardLevel: 5,
    traits: index === 0
      ? [{ traitCode: "TRANSITION_ENGINE", traitTier: 2, active: true }]
      : [],
    stats: {
      finishing: 78 + index,
      midRange: 74 + index,
      threePoint: 76 + index,
      playmaking: 77 + index,
      perimeterDefense: 76 + index,
      interiorDefense: 74 + index,
      strength: 75 + index,
    },
  }));
}

test("Battle strategy resolves Balanced defaults and bounded action weights", () => {
  const resolved = resolveBattleStrategy();

  assert.equal(resolved.resolverVersion, BATTLE_STRATEGY_RESOLVER_VERSION);
  assert.deepEqual(
    Object.fromEntries(Object.entries(resolved).filter(([key]) => key !== "resolverVersion")),
    DEFAULT_LINEUP_STRATEGY,
  );
  assert.equal(getStrategyActionMultiplier(resolved, "THREE_POINT"), 1);

  const paceSpace = resolveBattleStrategy({
    ...DEFAULT_LINEUP_STRATEGY,
    offense: "PACE_SPACE",
    tempo: "QUICK",
  });
  assert.ok(getStrategyActionMultiplier(paceSpace, "THREE_POINT") > 1);
  assert.ok(getStrategyActionMultiplier(paceSpace, "POST_UP") < 1);
});

test("Battle strategy rejects unknown client fields", () => {
  assert.throws(
    () => resolveBattleStrategy({ ...DEFAULT_LINEUP_STRATEGY, rawThreePointWeight: 99 }),
    /unsupported field/,
  );
});

test("Battle sub-seeds and AI strategy selection are stable by domain", () => {
  const offenseSeed = deriveBattleSeed(123456, "ai-offense-strategy");
  const defenseSeed = deriveBattleSeed(123456, "ai-defense-strategy");
  assert.notEqual(offenseSeed, defenseSeed);
  assert.equal(offenseSeed, deriveBattleSeed(123456, "ai-offense-strategy"));

  const first = selectAiStrategy({ team: team(), offenseSeed, defenseSeed });
  const second = selectAiStrategy({ team: team(), offenseSeed, defenseSeed });
  assert.deepEqual(second, first);
  assert.equal(first.resolverVersion, BATTLE_STRATEGY_RESOLVER_VERSION);
  assert.equal(first.mainHandler, "C");
});

test("Battle strategy upgrades legacy snapshots with PG as Main Handler", () => {
  const legacy = {
    schemaVersion: "strategy-v1",
    preset: "BALANCED",
    offense: "BALANCED",
    tempo: "STANDARD",
    defense: "BALANCED",
    rebounding: "BALANCED",
  };
  const resolved = resolveBattleStrategy(legacy);

  assert.equal(resolved.schemaVersion, "strategy-v4");
  assert.equal(resolved.mainHandler, "PG");
  assert.deepEqual(resolved.playerTendencies, {});
});
