import assert from "node:assert/strict";
import test from "node:test";

import {
  BATTLE_TENDENCY_RESOLVER_VERSION,
  getTendencyActionMultiplier,
} from "../src/modules/battle/battle-tendency.js";
import {
  DEFAULT_TENDENCY_PROFILE,
  normalizeTendencyProfile,
} from "../src/modules/tendency/index.js";

function profile(overrides = {}) {
  return { ...DEFAULT_TENDENCY_PROFILE, ...overrides };
}

function multiplier(profileValue, action, options = {}) {
  return getTendencyActionMultiplier({
    handlerProfile: profileValue,
    beneficiaryProfile: options.beneficiaryProfile ?? profileValue,
    action,
    handlerIsBeneficiary: options.handlerIsBeneficiary ?? true,
  });
}

test("Tendency profiles validate four independent behavior dimensions", () => {
  assert.equal(BATTLE_TENDENCY_RESOLVER_VERSION, "battle-tendencies-v2");
  assert.deepEqual(normalizeTendencyProfile(DEFAULT_TENDENCY_PROFILE), DEFAULT_TENDENCY_PROFILE);
  assert.throws(
    () => normalizeTendencyProfile({ ...DEFAULT_TENDENCY_PROFILE, decision: "HOG" }),
    /unsupported value/,
  );
});

test("Off-ball Tendencies belong to the beneficiary, not the passer", () => {
  const handler = profile({ creationRole: "BALANCED" });
  const receiver = profile({ creationRole: "OFF_BALL" });
  assert.ok(multiplier(handler, "CUT", {
    handlerIsBeneficiary: false,
    beneficiaryProfile: receiver,
  }) > 1);
  assert.equal(multiplier(handler, "CUT", {
    handlerIsBeneficiary: false,
    beneficiaryProfile: handler,
  }), 1);
});

test("Pass-first and score-first profiles change action choice, not shot accuracy", () => {
  const passFirst = profile({ decision: "PASS_FIRST" });
  const scoreFirst = profile({ decision: "SCORE_FIRST" });
  assert.ok(multiplier(passFirst, "PASS") > 1);
  assert.ok(multiplier(passFirst, "THREE_POINT") < 1);
  assert.ok(multiplier(scoreFirst, "PASS") < 1);
  assert.ok(multiplier(scoreFirst, "THREE_POINT") > 1);
});

test("Shot profile, creation role, and low usage apply bounded contextual weights", () => {
  const tendencies = profile({
    shotProfile: "PERIMETER",
    creationRole: "PICK_ROLL_HANDLER",
    usage: "LOW",
  });
  assert.ok(multiplier(tendencies, "PICK_AND_ROLL") > 1);
  assert.ok(multiplier(tendencies, "RELOCATE") > 1);
  assert.ok(multiplier(tendencies, "MID_RANGE") < 1);
  assert.ok(multiplier(tendencies, "PASS") > 1);
  assert.ok(multiplier(tendencies, "MID_RANGE") < 1);
});
