import assert from "node:assert/strict";
import test from "node:test";

import {
  calculatePlayerLevel,
  getPlayerLevelProgress,
  getTotalXpRequiredForLevel,
  getXpRequiredToAdvance,
} from "../src/modules/player/index.js";

test("Player XP thresholds increase by 1,000 XP per level", () => {
  assert.equal(getXpRequiredToAdvance(0), 1_000n);
  assert.equal(getXpRequiredToAdvance(1), 2_000n);
  assert.equal(getXpRequiredToAdvance(2), 3_000n);
  assert.equal(getTotalXpRequiredForLevel(0), 0n);
  assert.equal(getTotalXpRequiredForLevel(1), 1_000n);
  assert.equal(getTotalXpRequiredForLevel(2), 3_000n);
  assert.equal(getTotalXpRequiredForLevel(3), 6_000n);
});

test("Player Level derives from cumulative XP boundaries", () => {
  for (const [xp, level] of [
    [0, 0], [999, 0], [1_000, 1], [2_999, 1],
    [3_000, 2], [5_999, 2], [6_000, 3], [10_000, 4],
  ]) assert.equal(calculatePlayerLevel(xp), level);

  assert.deepEqual(getPlayerLevelProgress(3_500), {
    playerLevel: 2,
    totalXp: "3500",
    xpIntoLevel: "500",
    xpRequired: "3000",
    totalXpForNextLevel: "6000",
  });
});
