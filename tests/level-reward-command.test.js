import assert from "node:assert/strict";
import test from "node:test";

import { levelRewardCommand } from "../src/bot/commands/level-reward.command.js";
import { UI_EMOJIS } from "../src/bot/ui/emojis.js";

test("level-rewards claims all available milestones and renders progress", async () => {
  const replies = [];
  const interaction = {
    user: { id: "805986648973770783", username: "LevelTester" },
    async deferReply() {},
    async editReply(payload) { replies.push(payload); },
  };
  await levelRewardCommand.execute(interaction, {
    services: {
      player: {
        async getOrCreatePlayer() { return { playerId: "7" }; },
      },
      levelReward: {
        async claimAvailable(input) {
          assert.deepEqual(input, { playerId: "7" });
          return {
            playerLevel: 5,
            newClaims: [{
              milestoneLevel: 5,
              rewardSnapshot: {
                gold: 0,
                shards: 0,
                items: [{ itemType: "ALPHA_CONTRACT", itemName: "Alpha Contract", quantity: 1 }],
                cards: [],
              },
            }],
            milestones: [{
              level: 5,
              gold: 0,
              shards: 0,
              items: [{ itemType: "ALPHA_CONTRACT", itemName: "Alpha Contract", quantity: 1 }],
              cards: [],
              claimed: true,
              eligible: true,
            }],
          };
        },
      },
    },
  });
  const embed = replies[0].embeds[0].toJSON();
  assert.equal(embed.title, "LEVEL REWARDS");
  assert.match(embed.fields[0].value, /Level 5.*Alpha Contract/s);
  assert.match(embed.fields[1].value, /Lv\.5.*Alpha Contract/s);
  assert.match(embed.fields[0].value, new RegExp(UI_EMOJIS.alphaContract.id));
});
