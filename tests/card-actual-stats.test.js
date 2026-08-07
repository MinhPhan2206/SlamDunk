import assert from "node:assert/strict";
import test from "node:test";

import {
  getActualCardStat,
  getActualCardStats,
} from "../src/modules/card/index.js";

test("Card actual stats treat the Template as Level 5", () => {
  assert.equal(getActualCardStat(90, 1), 86);
  assert.equal(getActualCardStat(90, 2), 87);
  assert.equal(getActualCardStat(90, 3), 88);
  assert.equal(getActualCardStat(90, 4), 89);
  assert.equal(getActualCardStat(90, 5), 90);

  const stats = getActualCardStats({
    threePoint: 90,
    midRange: 91,
    finishing: 92,
    playmaking: 93,
    perimeterDefense: 94,
    interiorDefense: 95,
    strength: 96,
  }, 3);
  assert.deepEqual(stats, {
    threePoint: 88,
    midRange: 89,
    finishing: 90,
    playmaking: 91,
    perimeterDefense: 92,
    interiorDefense: 93,
    strength: 94,
  });
});
