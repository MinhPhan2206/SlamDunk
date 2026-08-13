import assert from "node:assert/strict";
import test from "node:test";

import { weeklyCommand } from "../src/bot/commands/weekly.command.js";

test("weekly command sends one compact reward line", async () => {
  const replies = [];
  const interaction = {
    id: "123456789012345678",
    user: { id: "234567890123456789", username: "WeeklyTester" },
    async deferReply() {},
    async editReply(payload) { replies.push(payload); },
  };
  const services = {
    player: { async getOrCreatePlayer() { return { playerId: "1" }; } },
    reward: {
      async weeklyReward() {
        return {
          rewardGold: "3500",
          rewardShards: "250",
          rewardXp: "1000",
        };
      },
    },
  };

  await weeklyCommand.execute(interaction, { services });

  assert.equal(replies[0].content, "You received 3,500 Gold and 250 Shards, and 1,000 XP.");
  assert.deepEqual(replies[0].embeds, []);
});
