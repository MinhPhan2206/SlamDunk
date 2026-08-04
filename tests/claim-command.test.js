import assert from "node:assert/strict";
import test from "node:test";

import { claimCommand } from "../src/bot/commands/claim.command.js";
import { RewardError } from "../src/modules/reward/index.js";

function createInteraction() {
  const replies = [];

  return {
    id: "123456789012345678",
    user: { id: "234567890123456789", username: "ClaimTester" },
    replies,
    async deferReply() {
      replies.push({ type: "defer" });
    },
    async editReply(payload) {
      replies.push({ type: "edit", payload });
    },
  };
}

test("claim command shows the awarded Gold and resulting balance", async () => {
  const interaction = createInteraction();
  const services = {
    player: {
      async getOrCreatePlayer() {
        return { playerId: "1" };
      },
    },
    reward: {
      async claimReward(input) {
        assert.deepEqual(input, {
          playerId: "1",
          interactionId: interaction.id,
        });
        return {
          rewardGold: "350",
          balanceAfter: "850",
          availableAt: new Date("2030-01-01T00:30:00.000Z"),
        };
      },
    },
  };

  await claimCommand.execute(interaction, { services });

  assert.equal(interaction.replies[0].type, "defer");
  assert.match(interaction.replies[1].payload.content, /350 Gold/);
  assert.match(interaction.replies[1].payload.content, /850 Gold/);
});

test("claim command maps an active cooldown to a Discord response", async () => {
  const interaction = createInteraction();
  const availableAt = new Date("2030-01-01T00:30:00.000Z");
  const services = {
    player: {
      async getOrCreatePlayer() {
        return { playerId: "1" };
      },
    },
    reward: {
      async claimReward() {
        throw new RewardError(
          "CLAIM_COOLDOWN_ACTIVE",
          "The claim cooldown is still active.",
          { availableAt },
        );
      },
    },
  };

  await claimCommand.execute(interaction, { services });

  assert.equal(interaction.replies[0].type, "defer");
  assert.match(interaction.replies[1].payload.content, /on cooldown/);
  assert.match(
    interaction.replies[1].payload.content,
    new RegExp(`<t:${Math.floor(availableAt.getTime() / 1_000)}:R>`),
  );
});
