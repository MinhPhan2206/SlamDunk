import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";

import { createMatchupImage } from "../src/bot/battle/matchup-image.js";
import { createDuelMatchupImage } from "../src/bot/battle/duel-matchup-image.js";

test("Battle matchup renderer creates one horizontal image for five AI players", async () => {
  const lineup = ["PG", "SG", "SF", "PF", "C"].map((slot, index) => ({
    slot,
    cardName: index === 0 ? "Stephen Curry" : `AI Player ${index + 1}`,
    overall: 90 + index,
    rarityCode: index === 0 ? "GOAT" : "ALPHA",
  }));
  const output = await createMatchupImage(lineup);

  const metadata = await sharp(output).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 890);
  assert.equal(metadata.height, 282);

  const playerNameOutput = await createMatchupImage(lineup.map((player) => ({
    ...player,
    playerName: player.cardName,
  })));
  assert.deepEqual(output, playerNameOutput);

  const unknownOutput = await createMatchupImage(lineup.map((player, index) => ({
    ...player,
    cardName: `Unknown AI Player ${index + 1}`,
  })));
  assert.notDeepEqual(output, unknownOutput);
});

test("Duel matchup renderer combines both complete Player lineups", async () => {
  const lineup = ["PG", "SG", "SF", "PF", "C"].map((slot, index) => ({
    slot,
    cardName: index === 0 ? "Stephen Curry" : `Duel Player ${index + 1}`,
    rarityCode: index === 0 ? "GOAT" : "ALPHA",
  }));
  const output = await createDuelMatchupImage(lineup, lineup, {
    challengerName: "Challenger",
    challengedName: "Opponent",
  });

  const metadata = await sharp(output).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 890);
  assert.equal(metadata.height, 728);
});
