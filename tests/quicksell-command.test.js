import assert from "node:assert/strict";
import test from "node:test";

import { quicksellCommand } from "../src/bot/commands/quicksell.command.js";

test("quicksell command destroys the selected card for Shards", async () => {
  const replies = [];
  const interaction = {
    user: { id: "234567890123456789", username: "QuicksellTester" },
    options: {
      getString(name) {
        assert.equal(name, "card_id");
        return "42";
      },
    },
    async deferReply() {
      replies.push({ type: "defer" });
    },
    async editReply(payload) {
      replies.push({ type: "edit", payload });
    },
  };
  const services = {
    player: {
      async getOrCreatePlayer() {
        return { playerId: "7" };
      },
    },
    quicksell: {
      async quicksell(input) {
        assert.deepEqual(input, { playerId: "7", cardInstanceId: "42" });
        return {
          card: {
            cardInstanceId: "42",
            playerName: "Test Guard",
            edition: "Base",
          },
          shardReward: 5,
          shardBalance: "15",
        };
      },
    },
  };

  await quicksellCommand.execute(interaction, { services });

  assert.equal(replies[0].type, "defer");
  const embed = replies[1].payload.embeds[0].toJSON();
  assert.match(embed.description, /Test Guard/);
  assert.match(embed.fields[0].value, /5 Shards/);
  assert.equal(embed.fields[1].value, "15");
});
