import assert from "node:assert/strict";
import test from "node:test";

import { readCardArt } from "../src/bot/ui/card-art.js";
import { createCardStripImage } from "../src/bot/ui/card-strip-image.js";

test("single-card image returns the original Card artwork without rendering", async () => {
  const card = { playerName: "Stephen Curry", rarityCode: "GOAT" };
  const [source, output] = await Promise.all([
    readCardArt(card),
    createCardStripImage([card]),
  ]);
  assert.strictEqual(output, source);
});
