import assert from "node:assert/strict";
import test from "node:test";

import { tradeCommand } from "../src/bot/commands/trade.command.js";

test("trade command creates an interactive Direct Trade", async () => {
  const replies = [];
  const invited = { id: "345678901234567890", username: "OtherPlayer", bot: false };
  const interaction = {
    user: { id: "234567890123456789", username: "TradeTester" },
    options: { getUser() { return invited; } },
    async deferReply() { replies.push("defer"); },
    async editReply(payload) { replies.push(payload); },
  };
  const services = {
    player: {
      async getOrCreatePlayer({ discordUserId }) {
        return { playerId: discordUserId === interaction.user.id ? "7" : "8" };
      },
    },
    trade: {
      async createTrade(input) {
        assert.deepEqual(input, { initiatorPlayerId: "7", invitedPlayerId: "8" });
        return {
          trade: { tradeId: "9", status: "OPEN", expiresAt: new Date(Date.now() + 60_000) },
          participants: [
            { playerId: "7", discordUserId: interaction.user.id, username: "TradeTester", goldOffered: "0", acceptedAt: null, confirmedAt: null },
            { playerId: "8", discordUserId: invited.id, username: "OtherPlayer", goldOffered: "0", acceptedAt: null, confirmedAt: null },
          ],
          cards: [],
        };
      },
      async expireTrade() {},
    },
  };

  await tradeCommand.execute(interaction, { services });

  assert.equal(replies[0], "defer");
  assert.equal(replies[1].components[0].components.length, 2);
  assert.equal(replies[1].embeds[0].toJSON().title, "Trade Invitation");
  assert.equal(tradeCommand.componentInactivityTimeoutMs, 180_000);
});
