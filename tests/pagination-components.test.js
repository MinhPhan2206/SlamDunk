import assert from "node:assert/strict";
import test from "node:test";

import { collectionPageComponent } from "../src/bot/components/collection-page.component.js";
import { marketPageComponent } from "../src/bot/components/market-page.component.js";
import { rarityPageComponent } from "../src/bot/components/rarity-page.component.js";

function interaction(customId) {
  const calls = [];
  return {
    calls,
    value: {
      customId,
      user: { id: "234567890123456789" },
      message: { embeds: [{ title: "Viewed User's Collection" }] },
      async deferUpdate() { calls.push("defer"); },
      async editReply(payload) { calls.push(payload); },
      async reply(payload) { calls.push(payload); },
    },
  };
}

test("Collection page button loads the requested owner page", async () => {
  const { value, calls } = interaction(
    "collection-page:234567890123456789:7:2",
  );
  await collectionPageComponent.execute(value, {
    services: {
      collection: {
        async listOwnedCards(input) {
          assert.deepEqual(input, { playerId: "7", page: 2 });
          return {
            cards: [], total: "11", page: 2, totalPages: 2,
            sortLabel: "Rarity",
          };
        },
      },
    },
  });
  assert.equal(calls[0], "defer");
  assert.equal(calls[1].embeds[0].toJSON().footer.text, "Page 2 of 2");
  assert.equal(calls[1].embeds[0].toJSON().title, "VIEWED USER'S COLLECTION");
});

test("Market page button loads the requested page", async () => {
  const { value, calls } = interaction("market-page:234567890123456789:2");
  await marketPageComponent.execute(value, {
    services: {
      market: {
        async listActiveListings(input) {
          assert.deepEqual(input, { page: 2 });
          return {
            listings: [], total: "11", page: 2, totalPages: 2,
          };
        },
      },
    },
  });
  assert.equal(calls[0], "defer");
  assert.match(calls[1].embeds[0].toJSON().description, /no active listings/i);
});

test("Rarity page button preserves rarity filters and sorting", async () => {
  const { value, calls } = interaction(
    "rarity-page:234567890123456789:ALPHA:PG:playmaking:2",
  );
  await rarityPageComponent.execute(value, {
    services: {
      cardTemplate: {
        async listTemplatesByRarity(rarityCode, options) {
          assert.equal(rarityCode, "ALPHA");
          assert.deepEqual(options, {
            position: "PG",
            sortBy: "playmaking",
            page: 2,
          });
          return {
            rarityCode,
            templates: [],
            total: 12,
            page: 2,
            totalPages: 2,
            position: "PG",
            sortBy: "playmaking",
            sortLabel: "Playmaking",
          };
        },
      },
    },
  });
  assert.equal(calls[0], "defer");
  assert.match(calls[1].embeds[0].toJSON().footer.text, /Page 2 of 2/);
});
