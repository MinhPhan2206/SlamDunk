import assert from "node:assert/strict";
import test from "node:test";

import { gameConfig } from "../src/config/game-config.js";
import {
  normalizeCardLevelWeights,
  rollCardLevel,
} from "../src/modules/card/card-level-roll.js";

test("Card Level weighted roll uses the approved 45/28/14/8/5 boundaries", () => {
  const weights = normalizeCardLevelWeights(gameConfig.drop.levelWeights);
  const cases = [
    [0, 1], [44, 1],
    [45, 2], [72, 2],
    [73, 3], [86, 3],
    [87, 4], [94, 4],
    [95, 5], [99, 5],
  ];

  for (const [roll, expectedLevel] of cases) {
    assert.equal(
      rollCardLevel(weights, (minimum, maximumExclusive) => {
        assert.equal(minimum, 0);
        assert.equal(maximumExclusive, 100);
        return roll;
      }),
      expectedLevel,
    );
  }
});

test("Drop and Standard Pack keep independently configurable Level weights", () => {
  assert.deepEqual(gameConfig.drop.levelWeights, gameConfig.packs[0].levelWeights);
  assert.notStrictEqual(gameConfig.drop.levelWeights, gameConfig.packs[0].levelWeights);
});
