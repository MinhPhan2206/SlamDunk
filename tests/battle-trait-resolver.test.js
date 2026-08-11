import assert from "node:assert/strict";
import test from "node:test";

import {
  APPROVED_BATTLE_TRAIT_CODES,
  BATTLE_TRAIT_RESOLVER_VERSION,
  resolveBattleTraitModifiers,
} from "../src/modules/battle/battle-trait-resolver.js";

function player(name, traits = []) {
  return {
    slot: "PG",
    cardName: name,
    cardTemplateId: name,
    cardInstanceId: name,
    traits: traits.map(([traitCode, traitTier, active = true]) => ({
      traitCode,
      traitTier,
      active,
    })),
  };
}

test("Battle Trait catalog exposes the approved 27 unique codes", () => {
  assert.equal(BATTLE_TRAIT_RESOLVER_VERSION, "battle-traits-v2");
  assert.equal(APPROVED_BATTLE_TRAIT_CODES.length, 27);
  assert.equal(new Set(APPROVED_BATTLE_TRAIT_CODES).size, 27);
});

test("Situational Traits activate only in their matching Battle context", () => {
  const shooter = player("Shooter", [
    ["TOUGH_SHOT_MAKER", 3],
    ["CLUTCH_PERFORMER", 2],
    ["COMEBACK_CATALYST", 1],
    ["MOMENTUM_SCORER", 2],
    ["COLD_BLOODED", 3],
  ]);
  const defender = player("Defender", [["CLUTCH_DEFENDER", 2]]);
  const result = resolveBattleTraitModifiers("SHOT_MAKE", {
    shotType: "THREE_POINT",
    shotQuality: "CONTESTED",
    shooter,
    defender,
    isClutch: true,
    isComeback: true,
    scoringStreak: 2,
    isGameWinningAttempt: true,
  });

  assert.equal(result.probabilityDelta, 0.075);
  assert.deepEqual(
    result.activations.map((entry) => entry.traitCode).sort(),
    [
      "CLUTCH_DEFENDER",
      "CLUTCH_PERFORMER",
      "COLD_BLOODED",
      "COMEBACK_CATALYST",
      "MOMENTUM_SCORER",
      "TOUGH_SHOT_MAKER",
    ],
  );

  const contact = resolveBattleTraitModifiers("SHOT_MAKE", {
    shotType: "FINISHING",
    shotQuality: "LIGHTLY_CONTESTED",
    shooter: player("Finisher", [["CONTACT_FINISHER", 2]]),
    defender,
    contact: true,
  });
  assert.equal(contact.probabilityDelta, 0.02);
});

test("Trait resolver applies contextual actor and defender effects", () => {
  const handler = player("Handler", [["SEPARATION_ARTIST", 3]]);
  const defender = player("Defender", [["POINT_OF_ATTACK_STOPPER", 1]]);
  const result = resolveBattleTraitModifiers("ADVANTAGE_CREATION", {
    action: "CREATE_SEPARATION",
    offense: [handler],
    handler,
    beneficiary: handler,
    defender,
  });

  assert.equal(result.scoreDelta, 4);
  assert.deepEqual(
    result.activations.map((activation) => activation.traitCode).sort(),
    ["POINT_OF_ATTACK_STOPPER", "SEPARATION_ARTIST"],
  );
});

test("Strongest-only Traits do not stack across a team", () => {
  const offense = [
    player("Floor I", [["FLOOR_GENERAL", 1]]),
    player("Floor III", [["FLOOR_GENERAL", 3]]),
    player("Inactive", [["FLOOR_GENERAL", 3, false]]),
  ];
  const result = resolveBattleTraitModifiers("ACTION_SELECTION", {
    action: "PASS",
    offense,
    handler: offense[0],
    beneficiary: offense[1],
  });

  assert.equal(result.scoreDelta, 6);
  assert.equal(result.activations.length, 1);
  assert.equal(result.activations[0].player.cardName, "Floor III");
});

test("Catch-and-shoot and Glass Cleaner use different bounded channels", () => {
  const shooter = player("Shooter", [["CATCH_AND_SHOOT", 2]]);
  const rebounder = player("Center", [["GLASS_CLEANER", 3]]);
  const shot = resolveBattleTraitModifiers("SHOT_QUALITY", {
    action: "EXTRA_PASS",
    shotType: "THREE_POINT",
    shotQuality: "CONTESTED",
    shooter,
    catchAndShoot: true,
  });
  const rebound = resolveBattleTraitModifiers("REBOUND", { rebounder });

  assert.equal(shot.qualityDelta, 4);
  assert.equal(shot.probabilityDelta, 0);
  assert.equal(rebound.probabilityDelta, 0.06);
  assert.equal(rebound.qualityDelta, 0);
});
