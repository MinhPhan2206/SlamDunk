import assert from "node:assert/strict";
import test from "node:test";

import { tradeComponent } from "../src/bot/components/trade.component.js";
import { createTradePayload } from "../src/bot/presenters/trade.presenter.js";

test("Trade Card modal asks whether Cards are added or removed", async () => {
  let modal;
  const interaction = {
    customId: "trade:cards:9:3",
    isButton() { return true; },
    async showModal(value) { modal = value.toJSON(); },
  };

  await tradeComponent.execute(interaction, { services: {} });

  assert.equal(modal.components.length, 2);
  assert.equal(modal.custom_id, "trade:cards:9:3");
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
            offerRevision: 0,
            reviewStartedAt: null,
          },
          participants: [
            { playerId: "7", discordUserId: "234567890123456789", username: "A", goldOffered: "0", acceptedAt: new Date(), readyAt: null, readyRevision: null, finalAcceptedAt: null, finalAcceptedRevision: null },
            { playerId: "8", discordUserId: "345678901234567890", username: "B", goldOffered: "0", acceptedAt: new Date(), readyAt: null, readyRevision: null, finalAcceptedAt: null, finalAcceptedRevision: null },
          ],
          cards: [],
        };
      },
    },
  };

  await tradeComponent.execute(interaction, { services });

  assert.deepEqual(acceptedInput, { tradeId: "9", playerId: "7" });
  assert.equal(edited.embeds[0].toJSON().title, "DIRECT TRADE");
  assert.equal(edited.components[0].components.length, 5);
  assert.equal(edited.components[0].components[2].data.custom_id, "trade:ready:9:0");
});

test("Final Accept is routed with the exact offer revision", async () => {
  let acceptedInput;
  const interaction = {
    customId: "trade:final:9:4",
    user: { id: "234567890123456789", username: "TradeTester" },
    isButton() { return true; },
    async deferUpdate() {},
    async editReply() {},
  };
  const services = {
    player: { async getOrCreatePlayer() { return { playerId: "7" }; } },
    trade: {
      async finalAcceptTrade(input) {
        acceptedInput = input;
        return {
          trade: { tradeId: "9", status: "COMPLETED", offerRevision: 4 },
          participants: [],
          cards: [],
        };
      },
    },
  };

  await tradeComponent.execute(interaction, { services });

  assert.deepEqual(acceptedInput, {
    tradeId: "9",
    playerId: "7",
    offerRevision: "4",
  });
});

test("Final Review freezes offer editing and exposes safe exit controls", () => {
  const now = new Date();
  const payload = createTradePayload({
    trade: {
      tradeId: "9",
      status: "OPEN",
      expiresAt: new Date(Date.now() + 180_000),
      offerRevision: 4,
      reviewStartedAt: now,
    },
    participants: [
      { playerId: "7", username: "A", goldOffered: "100", acceptedAt: now, readyAt: now, readyRevision: 4, finalAcceptedAt: null, finalAcceptedRevision: null },
      { playerId: "8", username: "B", goldOffered: "0", acceptedAt: now, readyAt: now, readyRevision: 4, finalAcceptedAt: null, finalAcceptedRevision: null },
    ],
    cards: [],
  });

  assert.equal(payload.embeds[0].toJSON().title, "TRADE REVIEW");
  assert.deepEqual(
    payload.components[0].components.map((button) => button.data.custom_id),
    ["trade:final:9:4", "trade:undo:9:4", "trade:cancel:9:4"],
  );
});
