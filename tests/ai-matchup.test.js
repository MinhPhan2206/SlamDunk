import assert from "node:assert/strict";
import test from "node:test";

import { selectAiMatchup } from "../src/modules/battle/ai-matchup.js";

const SLOTS = ["PG", "SG", "SF", "PF", "C"];

function stats(rating) {
  return {
    finishing: rating,
    midRange: rating,
    threePoint: rating,
    playmaking: rating,
    perimeterDefense: rating,
    interiorDefense: rating,
    strength: rating,
  };
}

function templates() {
  let id = 1;
  return SLOTS.flatMap((slot) => [78, 80, 82].map((rating) => ({
    cardTemplateId: String(id++),
    playerName: `${slot} Candidate ${rating}`,
    primaryPosition: slot,
    secondaryPosition: null,
    rarityCode: "COMMON",
    ...stats(rating),
  })));
}

const playerTeam = SLOTS.map((slot, index) => ({
  slot,
  cardLevel: index + 1,
  stats: stats(80),
}));

function select(seed) {
  return selectAiMatchup({
    templates: templates(),
    playerTeam,
    seed,
    candidatePoolSize: 3,
    ratingTolerance: 5,
  });
}

test("AI matchup selection is seeded, varied, and Level-matched by slot", () => {
  assert.deepEqual(select(12345), select(12345));

  const signatures = new Set();
  for (let seed = 1; seed <= 20; seed += 1) {
    const matchup = select(seed);
    signatures.add(matchup.map((entry) => entry.template.cardTemplateId).join(","));
    assert.deepEqual(matchup.map((entry) => entry.slot), SLOTS);
    assert.deepEqual(
      matchup.map((entry) => entry.cardLevel),
      playerTeam.map((entry) => entry.cardLevel),
    );
    assert.equal(new Set(matchup.map((entry) => entry.template.playerName)).size, 5);
  }
  assert.ok(signatures.size > 1);
});
