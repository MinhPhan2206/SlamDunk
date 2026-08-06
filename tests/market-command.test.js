import assert from "node:assert/strict";
import test from "node:test";

import { marketCommand } from "../src/bot/commands/market.command.js";

function createInteraction(subcommand, values = {}) {
  const replies = [];
  return {
    replies,
    interaction: {
      user: { id: "234567890123456789", username: "MarketTester" },
      options: {
        getSubcommand() {
          return subcommand;
        },
        getString(name) {
          return values[name];
        },
        getInteger(name) {
          return values[name];
        },
      },
      async deferReply() {
        replies.push({ type: "defer" });
      },
      async editReply(payload) {
        replies.push({ type: "edit", payload });
      },
    },
  };
}

const playerService = {
  async getOrCreatePlayer() {
    return { playerId: "7" };
  },
};

test("market sell command creates a fixed-price listing", async () => {
  const { interaction, replies } = createInteraction("sell", {
    card_id: "42",
    price: 500,
  });
  const services = {
    player: playerService,
    collection: {
      async resolveOwnedCardReference() {
        return "42";
      },
    },
    market: {
      async createListing(input) {
        assert.deepEqual(input, {
          sellerPlayerId: "7",
          cardInstanceId: "42",
          priceGold: 500,
        });
        return {
          listing: {
            listingId: "9",
            cardInstanceId: "42",
            priceGold: "500",
          },
          card: { publicCardId: "123456789" },
        };
      },
    },
  };

  await marketCommand.execute(interaction, { services });

  assert.equal(replies[0].type, "defer");
  const embed = replies[1].payload.embeds[0].toJSON();
  assert.match(embed.title, /Market Listing Created/);
  assert.equal(embed.fields[1].value, "500 Gold");
});

test("market browse command displays active listings", async () => {
  const { interaction, replies } = createInteraction("browse");
  const services = {
    player: playerService,
    market: {
      async listActiveListings() {
        return {
          listings: [
            {
              listingId: "9",
              cardInstanceId: "42",
              publicCardId: "123456789",
              priceGold: "500",
              sellerName: "Seller",
              playerName: "Test Guard",
              rarityCode: "COMMON",
              serialNumber: "3",
              cardLevel: 4,
            },
          ],
        };
      },
    },
  };

  await marketCommand.execute(interaction, { services });

  const embed = replies[1].payload.embeds[0].toJSON();
  assert.match(embed.description, /Test Guard/);
  assert.match(embed.description, /500 Gold/);
});
