import assert from "node:assert/strict";
import test from "node:test";

import { quicksellCommand } from "../src/bot/commands/quicksell.command.js";
import { quicksellComponent } from "../src/bot/components/quicksell.component.js";

test("quicksell command previews the selected cards before destruction", async () => {
  const replies = [];
  const interaction = {
    id: "777777777777777777",
    user: { id: "234567890123456789", username: "QuicksellTester" },
    options: {
      getString(name) {
        assert.equal(name, "params");
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
    collection: {
      async resolveOwnedCardReference() {
        return "42";
      },
    },
    player: {
      async getOrCreatePlayer() {
        return { playerId: "7" };
      },
    },
    quicksell: {
      async createPreview(input) {
        assert.deepEqual(input, {
          playerId: "7",
          params: "42",
          interactionId: interaction.id,
          cardInstanceId: "42",
        });
        return {
          session: { quicksellSessionId: "9", totalGold: "40", totalShards: "8" },
          cards: [{
            cardInstanceId: "42", publicCardId: "123456789",
            playerName: "Test Guard",
            rarityCode: "UNCOMMON", goldReward: 40, shardReward: 8,
          }],
        };
      },
    },
  };

  await quicksellCommand.execute(interaction, { services });

  assert.equal(replies[0].type, "defer");
  const embed = replies[1].payload.embeds[0].toJSON();
  assert.match(embed.description, /Test Guard/);
  assert.match(embed.description, /40 Gold/);
  assert.match(embed.description, /8 Shards/);
  assert.match(
    embed.description,
    /Test Guard\s+Uncommon\s+\d*\s+!123456789\s+40\s+8/,
  );
  assert.doesNotMatch(embed.description, /\+[-+]+\+/);
  assert.equal(replies[1].payload.components.length, 1);
});

test("quicksell confirm button completes the persisted preview", async () => {
  const edits = [];
  const interaction = {
    customId: "quicksell:confirm:9",
    user: { id: "234567890123456789", username: "QuicksellTester" },
    async deferUpdate() {},
    async editReply(payload) { edits.push(payload); },
  };
  const services = {
    player: { async getOrCreatePlayer() { return { playerId: "7" }; } },
    quicksell: {
      async confirmPreview(input) {
        assert.deepEqual(input, { playerId: "7", quicksellSessionId: "9" });
        return {
          session: {
            totalGold: "40",
            totalShards: "8",
            goldBalanceAfter: "140",
            shardBalanceAfter: "18",
          },
          cards: [{ cardInstanceId: "42" }],
        };
      },
    },
  };

  await quicksellComponent.execute(interaction, { services });

  assert.equal(edits[0].components.length, 0);
  assert.equal(edits[0].embeds[0].toJSON().title, "QUICKSELL COMPLETE");
});
