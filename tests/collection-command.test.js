import assert from "node:assert/strict";
import test from "node:test";

import { collectionCommand } from "../src/bot/commands/collection.command.js";

test("collection command displays active cards for the current Player", async () => {
  const replies = [];
  const interaction = {
    user: { id: "234567890123456789", username: "CollectionTester" },
    options: {
      getInteger(name) {
        return name === "tier" ? 6 : 1;
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
        return { playerId: "8" };
      },
    },
    collection: {
      async listOwnedCards(input) {
        assert.deepEqual(input, {
          playerId: "8",
          rarityTier: 6,
          page: 1,
        });
        return {
          cards: [
            {
              playerName: "Test Player",
              edition: "Base",
              rarityTier: 6,
              overall: 94,
              primaryPosition: "SF",
              secondaryPosition: "PF",
              cardLevel: 3,
              serialNumber: "12",
            },
          ],
          total: "1",
          page: 1,
          totalPages: 1,
          rarityTier: 6,
        };
      },
    },
  };

  await collectionCommand.execute(interaction, { services });

  assert.equal(replies[0].type, "defer");
  const embed = replies[1].payload.embeds[0].toJSON();
  assert.match(embed.description, /Test Player/);
  assert.match(embed.description, /Level 3/);
  assert.match(embed.description, /#12/);
});
