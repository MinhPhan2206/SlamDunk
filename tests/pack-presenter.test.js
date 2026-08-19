import assert from "node:assert/strict";
import test from "node:test";

import { packCommand } from "../src/bot/commands/pack.command.js";
import { createPackOpeningPayload } from "../src/bot/presenters/pack.presenter.js";

test("Pack command displays the current configured prices", () => {
  const choices = packCommand.data.toJSON().options[0].choices.map(
    ({ name, value }) => ({ name, value }),
  );
  assert.deepEqual(choices, [
    { name: "Standard Pack (5,000 Gold)", value: "standard" },
    { name: "Super Pack (2,000 Shards)", value: "super" },
  ]);
});

test("Pack result uses Card artwork and omits OVR and Serial", async () => {
  const payload = await createPackOpeningPayload({
    pack: {
      displayName: "Standard Pack",
      priceCurrency: "GOLD",
      priceAmount: 3_000,
    },
    cards: [
      {
        template: {
          playerName: "Michael Jordan",
          rarityCode: "GOAT",
          primaryPosition: "SG",
          secondaryPosition: "SF",
        },
        instance: { cardLevel: 5, publicCardId: "123456789", serialNumber: "1" },
      },
      {
        template: {
          playerName: "Stephen Curry",
          rarityCode: "COMMON",
          primaryPosition: "PG",
          secondaryPosition: "SG",
        },
        instance: { cardLevel: 2, publicCardId: "223456789", serialNumber: "2" },
      },
      {
        template: {
          playerName: "LeBron James",
          rarityCode: "ALPHA",
          primaryPosition: "SF",
          secondaryPosition: "PF",
        },
        instance: { cardLevel: 3, publicCardId: "323456789", serialNumber: "3" },
      },
    ],
  });

  const embed = payload.embeds[0].toJSON();
  assert.equal(payload.files[0].name, "pack-result.png");
  assert.match(embed.description, /Michael Jordan/);
  assert.match(embed.description, /Stephen Curry/);
  assert.match(embed.description, /LeBron James/);
  assert.match(embed.description, /Lv\.5/);
  assert.doesNotMatch(embed.description, /OVR|Serial|#1/);
  assert.equal(payload.files[0].attachment.readUInt32BE(16), 800);
  assert.equal(payload.files[0].attachment.readUInt32BE(20), 423);
});
