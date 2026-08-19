import assert from "node:assert/strict";
import test from "node:test";

import {
  buyCommand,
  marketCommand,
  sellCommand,
  unlistCommand,
} from "../src/bot/commands/market.command.js";
import { marketSellComponent } from "../src/bot/components/market-sell.component.js";

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
      async reply(payload) {
        replies.push({ type: "reply", payload });
      },
      async showModal(payload) {
        replies.push({ type: "modal", payload });
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

test("Market actions are separate slash commands", () => {
  assert.equal(marketCommand.data.name, "market");
  assert.equal(sellCommand.data.name, "sell");
  assert.equal(unlistCommand.data.name, "unlist");
  assert.equal(buyCommand.data.name, "buy");
});

test("market sell command opens button controls defaulting to 12 hours", async () => {
  const { interaction, replies } = createInteraction("sell", {
    card_id: "42",
    price: 500,
  });
  await sellCommand.execute(interaction, { services: {
    player: playerService,
    collection: {
      async resolveOwnedCardReference() { return "81"; },
    },
    cardView: {
      async getInstance() {
        return {
          cardInstanceId: "81",
          publicCardId: "123456789",
          playerName: "Test Guard",
          rarityCode: "COMMON",
        };
      },
    },
  } });

  assert.equal(replies[0].type, "defer");
  assert.equal(replies[1].type, "edit");
  const payload = replies[1].payload;
  assert.equal(payload.embeds[0].toJSON().fields[1].value, "12 hours");
  assert.equal(payload.components[0].components.length, 5);
  assert.equal(
    payload.components[0].components[0].data.custom_id,
    "market-sell:decrease:234567890123456789:81:500:2",
  );
});

test("market sell buttons adjust duration and confirm the timed listing", async () => {
  const card = {
    cardInstanceId: "81",
    publicCardId: "123456789",
    playerName: "Test Guard",
    rarityCode: "COMMON",
  };
  let adjusted;
  await marketSellComponent.execute({
    customId: "market-sell:increase:234567890123456789:81:500:2",
    user: { id: "234567890123456789", username: "MarketTester" },
    async update(payload) { adjusted = payload; },
  }, {
    services: { cardView: { async getInstance() { return card; } } },
  });
  assert.equal(adjusted.embeds[0].toJSON().fields[1].value, "1 day");
  assert.match(
    adjusted.components[0].components[3].data.custom_id,
    /:3$/,
  );

  let reply;
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1_000);
  await marketSellComponent.execute({
    customId: "market-sell:confirm:234567890123456789:81:500:2",
    user: { id: "234567890123456789", username: "MarketTester" },
    async deferUpdate() { this.deferred = true; },
    async editReply(payload) { reply = payload; },
  }, {
    services: {
      cardView: { async getInstance() { return card; } },
      player: playerService,
      market: {
        async createListing(input) {
          assert.deepEqual(input, {
            sellerPlayerId: "7",
            cardInstanceId: "81",
            priceGold: "500",
            durationCode: "12h",
          });
          return {
            listing: {
              playerName: "Test Guard",
              rarityCode: "COMMON",
              priceGold: "500",
              expiresAt,
            },
            card: { publicCardId: "123456789" },
          };
        },
      },
    },
  });
  assert.match(reply.embeds[0].toJSON().description, /Test Guard.*!123456789/s);
  assert.deepEqual(reply.components, []);
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
              playerName: "Tyrese Haliburton",
              rarityCode: "COMMON",
              serialNumber: "3",
              cardLevel: 4,
              expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1_000),
            },
          ],
          total: "11",
          page: 1,
          totalPages: 2,
        };
      },
    },
  };

  await marketCommand.execute(interaction, { services });

  const embed = replies[1].payload.embeds[0].toJSON();
  assert.match(embed.description, /T\. Haliburton/);
  assert.match(embed.description, /500/);
  assert.match(embed.description, /!123456789/);
  assert.doesNotMatch(embed.description, /\+-+/);
  assert.doesNotMatch(embed.description, /Seller|#9/);
  const buttons = replies[1].payload.components[0].components;
  assert.equal(buttons.length, 2);
  assert.equal(buttons[0].data.emoji.name, "◀️");
  assert.equal(buttons[1].data.emoji.name, "▶️");
});

test("buy and unlist resolve an active listing by public Card ID", async () => {
  for (const [command, serviceMethod, playerField] of [
    [buyCommand, "buyListing", "buyerPlayerId"],
    [unlistCommand, "cancelListing", "sellerPlayerId"],
  ]) {
    const { interaction, replies } = createInteraction(null, { card_id: "!123456789" });
    const services = {
      player: playerService,
      market: {
        async [serviceMethod](input) {
          assert.equal(input[playerField], "7");
          assert.equal(input.publicCardId, "123456789");
          return serviceMethod === "buyListing"
            ? {
                listing: {
                  priceGold: "500",
                  playerName: "Test Guard",
                  rarityCode: "COMMON",
                },
                card: { publicCardId: "123456789" },
                economy: { debit: { balanceAfter: "500" } },
              }
            : {
                listing: {
                  publicCardId: "123456789",
                  playerName: "Test Guard",
                  rarityCode: "COMMON",
                  cardLevel: 2,
                },
              };
        },
      },
    };
    await command.execute(interaction, { services });
    const description = replies[1].payload.embeds[0].toJSON().description;
    assert.match(description, /Test Guard/);
    assert.match(description, /!123456789/);
    assert.doesNotMatch(description, /undefined/);
    assert.doesNotMatch(description, /Â/);
    if (serviceMethod === "cancelListing") {
      assert.match(description, /\*\*Test Guard\*\* \u00B7 Common \u00B7 Lv\.2/);
    }
  }
});
