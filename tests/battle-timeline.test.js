import assert from "node:assert/strict";
import test from "node:test";

import { createBattleTimeline } from "../src/bot/battle/battle-timeline.js";

test("Battle timeline separates action, shot result, and rebound into short lines", () => {
  const timeline = createBattleTimeline([{
    possession: 1,
    offenseTeam: 1,
    action: "DRIVE",
    result: "MISS",
    shotType: "FINISHING",
    points: 0,
    handler: { cardName: "Guard" },
    shooter: { cardName: "Guard" },
    primaryDefender: { cardName: "Defender" },
    shotDefender: { cardName: "Center" },
    rebounder: { cardName: "Center" },
    reboundTeam: 2,
    score: { 1: 0, 2: 0 },
  }]);

  assert.equal(timeline.length, 4);
  assert.match(timeline[0].description, /^🔸/u);
  assert.match(timeline[0].description, /attacks the lane/);
  assert.match(timeline[1].description, /tries a contested/);
  assert.match(timeline[2].description, /misses the attempt/);
  assert.match(timeline[3].description, /^🔹/u);
  assert.match(timeline[3].description, /defensive rebound/);
  assert.ok(timeline.every((line) => /`[^`]+`/.test(line.description)));
  assert.equal(timeline[0].completesPossession, false);
  assert.equal(timeline[3].completesPossession, true);
});
