import assert from "node:assert/strict";
import test from "node:test";

import { createPackOpeningPayload } from "../src/bot/presenters/pack.presenter.js";

test("Pack result uses Card artwork and omits OVR and Serial", async () => {
  const payload = await createPackOpeningPayload({
    pack: { displayName: "Standard Pack", priceGold: 1_000 },
    template: {
      playerName: "Michael Jordan",
      rarityCode: "GOAT",
      primaryPosition: "SG",
      secondaryPosition: "SF",
    },
    instance: {
      cardLevel: 5,
      publicCardId: "123456789",
      serialNumber: "1",
    },
  });

  const embed = payload.embeds[0].toJSON();
  assert.equal(payload.files[0].name, "pack-result.png");
  assert.match(embed.description, /Michael Jordan/);
  assert.match(embed.description, /Lv\.5/);
  assert.doesNotMatch(embed.description, /OVR|Serial|#1/);
  assert.equal(payload.files[0].attachment.readUInt32BE(16), 448);
  assert.equal(payload.files[0].attachment.readUInt32BE(20), 673);
});
