import assert from "node:assert/strict";
import test from "node:test";

import { exchangeComponent } from "../src/bot/components/exchange.component.js";
import { createExchangeMenu } from "../src/bot/presenters/exchange.presenter.js";

const offer = Object.freeze({
  offerCode: "level_up",
  inputAmount: 1_500,
  outputItemName: "Level Up",
  outputQuantity: 1,
});

test("Exchange menu adjusts quantity with buttons and shows the total", () => {
  const payload = createExchangeMenu({
    playerId: "10",
    shardBalance: "10000",
    offers: [offer],
    selected: true,
    quantity: 3,
    maximumQuantity: 100,
  });
  const embed = payload.embeds[0].toJSON();
  const quantityRow = payload.components[1].toJSON();
  const confirmRow = payload.components[2].toJSON();

  assert.match(embed.description, /Quantity: \*\*3\*\*/);
  assert.match(embed.description, /4,500/);
  assert.match(embed.description, /\*\*3 Level Up\*\*/);
  assert.equal(quantityRow.components[0].custom_id, "exchange:decrease:10:level_up:3");
  assert.equal(quantityRow.components[1].label, "Quantity: 3");
  assert.equal(quantityRow.components[2].custom_id, "exchange:increase:10:level_up:3");
  assert.equal(confirmRow.components[0].custom_id, "exchange:confirm:10:level_up:3");
});

test("Exchange quantity button preserves selection and increments once", async () => {
  const updates = [];
  const interaction = {
    customId: "exchange:increase:10:level_up:2",
    user: { id: "20", username: "Tester" },
    async update(payload) { updates.push(payload); },
  };
  const services = {
    player: {
      async getOrCreatePlayer() { return { playerId: "10" }; },
    },
    economy: {
      async getBalance() { return { shardBalance: "10000" }; },
    },
    exchange: {
      maximumQuantity: 100,
      listOffers() { return [offer]; },
    },
  };

  await exchangeComponent.execute(interaction, { services });
  assert.equal(updates[0].components[1].components[1].data.label, "Quantity: 3");
  assert.equal(
    updates[0].components[2].components[0].data.custom_id,
    "exchange:confirm:10:level_up:3",
  );
});

test("Exchange confirm sends the selected quantity to the service", async () => {
  let exchangeInput;
  const interaction = {
    id: "123456789012345678",
    customId: "exchange:confirm:10:level_up:4",
    user: { id: "20", username: "Tester" },
    async deferUpdate() {},
    async editReply() {},
  };
  await exchangeComponent.execute(interaction, {
    services: {
      player: {
        async getOrCreatePlayer() { return { playerId: "10" }; },
      },
      exchange: {
        async exchange(input) {
          exchangeInput = input;
          return {
            offer: { ...offer, inputAmount: 6_000, outputQuantity: 4 },
            shardBalanceAfter: "4000",
          };
        },
      },
    },
  });
  assert.equal(exchangeInput.quantity, 4);
  assert.equal(exchangeInput.offerCode, "level_up");
});
