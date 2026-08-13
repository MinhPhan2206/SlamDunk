import assert from "node:assert/strict";
import test from "node:test";

import { dailyCommand } from "../src/bot/commands/daily.command.js";

test("daily command sends one compact reward line", async () => {
  const replies = [];
  const interaction = {
    id: "123456789012345678",
    user: { id: "234567890123456789", username: "DailyTester" },
    async deferReply() {},
    async editReply(payload) { replies.push(payload); },
  };
  const services = {
    player: { async getOrCreatePlayer() { return { playerId: "1" }; } },
    reward: {
      async dailyReward() {
        return { rewardGold: "1750", rewardShards: "25", rewardXp: "300" };
      },
    },
  };

  await dailyCommand.execute(interaction, { services });

  assert.equal(replies[0].content, "You received 1,750 Gold and 25 Shards, and 300 XP.");
  assert.deepEqual(replies[0].embeds, []);
});
