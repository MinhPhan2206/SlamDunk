import assert from "node:assert/strict";
import test from "node:test";

import { tradeComponent } from "../src/bot/components/trade.component.js";

test("Trade Card modal asks whether Cards are added or removed", async () => {
  let modal;
  const interaction = {
    customId: "trade:cards:9",
    isButton() { return true; },
    async showModal(value) { modal = value.toJSON(); },
  };

  await tradeComponent.execute(interaction, { services: {} });

  assert.equal(modal.components.length, 2);
  assert.equal(modal.components[0].components[0].custom_id, "operation");
  assert.equal(modal.components[1].components[0].custom_id, "card_ids");
  assert.equal(tradeComponent.componentInactivityTimeoutMs, 180_000);
});

test("Accepting the invitation opens Trade controls after both Players accept", async () => {
  let acceptedInput;
  let edited;
  const interaction = {
    customId: "trade:accept:9",
    user: { id: "234567890123456789", username: "TradeTester" },
    isButton() { return true; },
    async deferUpdate() {},
    async editReply(payload) { edited = payload; },
  };
  const services = {
    player: { async getOrCreatePlayer() { return { playerId: "7" }; } },
    trade: {
      async acceptTrade(input) {
        acceptedInput = input;
        return {
          trade: {
            tradeId: "9",
            status: "OPEN",
            expiresAt: new Date(Date.now() + 180_000),
          },
          participants: [
            { playerId: "7", discordUserId: "234567890123456789", username: "A", goldOffered: "0", acceptedAt: new Date(), confirmedAt: null },
            { playerId: "8", discordUserId: "345678901234567890", username: "B", goldOffered: "0", acceptedAt: new Date(), confirmedAt: null },
          ],
          cards: [],
        };
      },
    },
  };

  await tradeComponent.execute(interaction, { services });

  assert.deepEqual(acceptedInput, { tradeId: "9", playerId: "7" });
  assert.equal(edited.embeds[0].toJSON().title, "Direct Trade");
  assert.equal(edited.components[0].components.length, 4);
});
