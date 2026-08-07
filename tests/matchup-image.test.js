import assert from "node:assert/strict";
import test from "node:test";

import { createMatchupImage } from "../src/bot/battle/matchup-image.js";

test("Battle matchup renderer creates one horizontal image for five AI players", async () => {
  const lineup = ["PG", "SG", "SF", "PF", "C"].map((slot, index) => ({
    slot,
    cardName: `AI Player ${index + 1}`,
    overall: 90 + index,
    rarityCode: index === 4 ? "GOAT" : "ALPHA",
  }));
  const output = await createMatchupImage(lineup);

  assert.deepEqual([...output.subarray(1, 4)], [80, 78, 71]);
  assert.equal(output.readUInt32BE(16), 954);
  assert.equal(output.readUInt32BE(20), 314);
});
