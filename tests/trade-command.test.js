import assert from "node:assert/strict";
import test from "node:test";

import { tradeCommand } from "../src/bot/commands/trade.command.js";

function createInteraction(subcommand, values = {}) {
  const replies = [];
  return {
    replies,
    interaction: {
      user: { id: "234567890123456789", username: "TradeTester" },
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
        getUser(name) {
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

function tradeState(status = "OPEN") {
  return {
    trade: { tradeId: "9", status },
    participants: [
      {
        playerId: "7",
        username: "TradeTester",
        goldOffered: "0",
        confirmedAt: null,
      },
      {
        playerId: "8",
        username: "OtherPlayer",
        goldOffered: "0",
        confirmedAt: null,
      },
    ],
    cards: [],
  };
}

test("trade create command creates the invited Player and Direct Trade", async () => {
  const { interaction, replies } = createInteraction("create", {
    user: { id: "345678901234567890", username: "OtherPlayer", bot: false },
  });
  const services = {
    player: {
      async getOrCreatePlayer({ discordUserId }) {
        return {
          playerId: discordUserId === interaction.user.id ? "7" : "8",
        };
      },
    },
    trade: {
      async createTrade(input) {
        assert.deepEqual(input, {
          initiatorPlayerId: "7",
          invitedPlayerId: "8",
        });
        return tradeState();
      },
    },
  };

  await tradeCommand.execute(interaction, { services });

  assert.equal(replies[0].type, "defer");
  const embed = replies[1].payload.embeds[0].toJSON();
  assert.match(embed.title, /Direct Trade Created/);
  assert.match(embed.description, /Trade 9/);
});

test("trade confirm command displays a completed trade", async () => {
  const { interaction, replies } = createInteraction("confirm", {
    trade_id: "9",
  });
  const services = {
    player: {
      async getOrCreatePlayer() {
        return { playerId: "7" };
      },
    },
    trade: {
      async confirmTrade(input) {
        assert.deepEqual(input, { tradeId: "9", playerId: "7" });
        return { ...tradeState("COMPLETED"), completed: true };
      },
    },
  };

  await tradeCommand.execute(interaction, { services });

  const embed = replies[1].payload.embeds[0].toJSON();
  assert.match(embed.title, /Direct Trade Completed/);
  assert.match(embed.description, /COMPLETED/);
});
