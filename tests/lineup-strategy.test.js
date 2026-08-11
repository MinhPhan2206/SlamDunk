import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_LINEUP_STRATEGY,
  getPlayerTendency,
  normalizeLineupStrategy,
  prunePlayerTendencies,
  setPlayerTendency,
} from "../src/modules/lineup/index.js";
import { DEFAULT_TENDENCY_PROFILE } from "../src/modules/tendency/index.js";

test("Lineup strategy exposes independent team settings without presets", () => {
  assert.deepEqual(normalizeLineupStrategy(), DEFAULT_LINEUP_STRATEGY);
  assert.equal(DEFAULT_LINEUP_STRATEGY.schemaVersion, "strategy-v4");
  assert.equal(Object.hasOwn(DEFAULT_LINEUP_STRATEGY, "preset"), false);
  assert.deepEqual(DEFAULT_LINEUP_STRATEGY.playerTendencies, {});

  const custom = normalizeLineupStrategy({
    ...DEFAULT_LINEUP_STRATEGY,
    mainHandler: "SG",
    offense: "MOTION",
    tempo: "QUICK",
    defense: "SWITCH",
    rebounding: "GET_BACK",
  });
  assert.equal(custom.offense, "MOTION");
  assert.equal(custom.mainHandler, "SG");
});

test("Lineup strategy stores and prunes Tendencies by Card Instance ID", () => {
  const passFirst = { ...DEFAULT_TENDENCY_PROFILE, decision: "PASS_FIRST" };
  const configured = setPlayerTendency(DEFAULT_LINEUP_STRATEGY, "101", passFirst);
  assert.equal(getPlayerTendency(configured, "101").decision, "PASS_FIRST");
  assert.deepEqual(getPlayerTendency(configured, "202"), DEFAULT_TENDENCY_PROFILE);

  const pruned = prunePlayerTendencies(configured, ["202"]);
  assert.deepEqual(pruned.playerTendencies, {});
});

test("Lineup strategy rejects unsupported or incomplete configuration", () => {
  assert.throws(
    () => normalizeLineupStrategy({
      ...DEFAULT_LINEUP_STRATEGY,
      schemaVersion: "strategy-v3",
    }),
    /schemaVersion is unsupported/,
  );
  assert.throws(
    () => normalizeLineupStrategy({ ...DEFAULT_LINEUP_STRATEGY, offense: "AUTO_WIN" }),
    /offense has an unsupported value/,
  );
  assert.throws(
    () => normalizeLineupStrategy({ ...DEFAULT_LINEUP_STRATEGY, preset: "BALANCED" }),
    /unsupported field: preset/,
  );
  assert.throws(
    () => setPlayerTendency(DEFAULT_LINEUP_STRATEGY, "invalid", DEFAULT_TENDENCY_PROFILE),
    /Card Instance IDs/,
  );
  const { defense: _defense, ...missingDefense } = DEFAULT_LINEUP_STRATEGY;
  assert.throws(() => normalizeLineupStrategy(missingDefense), /missing required field: defense/);
});
