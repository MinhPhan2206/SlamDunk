import assert from "node:assert/strict";
import test from "node:test";

import { gameConfig } from "../src/config/game-config.js";
import { selectAiMatchup } from "../src/modules/battle/ai-matchup.js";
import {
  calculatePracticeTeamPower,
  selectPracticeAiMatchup,
} from "../src/modules/battle/practice-matchup.js";

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

test("AI matchup selection is seeded, varied, and always uses Level 5 AI Cards", () => {
  assert.deepEqual(select(12345), select(12345));

  const signatures = new Set();
  for (let seed = 1; seed <= 20; seed += 1) {
    const matchup = select(seed);
    signatures.add(matchup.map((entry) => entry.template.cardTemplateId).join(","));
    assert.deepEqual(matchup.map((entry) => entry.slot), SLOTS);
    assert.deepEqual(
      matchup.map((entry) => entry.cardLevel),
      [5, 5, 5, 5, 5],
    );
    assert.equal(new Set(matchup.map((entry) => entry.template.playerName)).size, 5);
  }
  assert.ok(signatures.size > 1);
});

test("Practice matchup uses adaptive levels and a deterministic Team Power budget", () => {
  const practiceTemplates = SLOTS.flatMap((slot, slotIndex) =>
    [62, 68, 74, 80, 86].map((rating, index) => ({
      cardTemplateId: String(slotIndex * 10 + index + 100),
      playerName: `${slot} Practice ${rating}`,
      primaryPosition: slot,
      secondaryPosition: null,
      rarityCode: rating === 62 ? "BASE" : "COMMON",
      traits: index >= 3
        ? [{ traitCode: "CATCH_AND_SHOOT", traitTier: index - 2 }]
        : [],
      ...stats(rating),
    }))
  );
  const practicePlayerTeam = SLOTS.map((slot, index) => ({
    slot,
    cardLevel: 3,
    traits: [{ traitCode: "CATCH_AND_SHOOT", traitTier: 2 }],
    stats: stats(80 + index),
  }));
  const input = {
    templates: practiceTemplates,
    playerTeam: practicePlayerTeam,
    seed: 12345,
    bracketCode: "street",
    config: gameConfig.battle.practice,
  };
  const first = selectPracticeAiMatchup(input);
  const second = selectPracticeAiMatchup(input);

  assert.deepEqual(second, first);
  assert.deepEqual(first.lineup.map((entry) => entry.slot), SLOTS);
  assert.ok(first.lineup.every((entry) => entry.cardLevel === 2));
  assert.equal(new Set(first.lineup.map((entry) => entry.template.playerName)).size, 5);
  assert.ok(first.metadata.aiPower < calculatePracticeTeamPower(practicePlayerTeam));
  assert.equal(first.metadata.balancedAi, true);
});

test("Practice rookie protection uses Base Level 1 opponents with a stat adjustment", () => {
  const rookieTeam = SLOTS.map((slot) => ({
    slot,
    cardLevel: 1,
    traits: [],
    stats: stats(64),
  }));
  const result = selectPracticeAiMatchup({
    templates: templates().map((template, index) => ({
      ...template,
      rarityCode: index % 2 === 0 ? "BASE" : "COMMON",
      traits: [],
    })),
    playerTeam: rookieTeam,
    seed: 54321,
    bracketCode: "street",
    config: gameConfig.battle.practice,
  });

  assert.ok(result.lineup.every((entry) => entry.template.rarityCode === "BASE"));
  assert.ok(result.lineup.every((entry) => entry.cardLevel === 1));
  assert.equal(
    result.metadata.statAdjustment,
    gameConfig.battle.practice.rookieAiStatAdjustment,
  );
});
