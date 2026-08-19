import assert from "node:assert/strict";
import test from "node:test";

import { collectionCommand } from "../src/bot/commands/collection.command.js";
import { formatCompactPlayerName } from "../src/bot/ui/player-name.js";

test("Collection shortens long player names without changing recognizable surnames", () => {
  assert.equal(formatCompactPlayerName("Tyrese Haliburton"), "T. Haliburton");
  assert.equal(formatCompactPlayerName("Nickeil Alexander-Walker"), "N. Alexander-W.");
  assert.equal(formatCompactPlayerName("Giannis Antetokounmpo"), "Antetokounmpo");
  assert.equal(formatCompactPlayerName("Jaren Jackson Jr."), "J. Jackson Jr.");
});

test("collection command displays active cards for the current Player", async () => {
  const replies = [];
  const interaction = {
    user: { id: "234567890123456789", username: "CollectionTester" },
    options: {
      getUser() {
        return null;
      },
      getInteger(name) {
        return name === "page" ? 1 : null;
      },
      getString(name) {
        return name === "rarity" ? "SUPERSTAR" : null;
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
          page: 1,
        });
        return {
          cards: [
            {
              playerName: "Test Player",
              collectionPosition: 1,
              publicCardId: "123456789",
              rarityCode: "SUPERSTAR",
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
          sortLabel: "Oldest",
        };
      },
    },
  };

  await collectionCommand.execute(interaction, { services });

  assert.equal(replies[0].type, "defer");
  const embed = replies[1].payload.embeds[0].toJSON();
  assert.equal(embed.thumbnail, undefined);
  assert.match(embed.description, /Test Player/);
  assert.match(embed.description, /SF\/PF\s+3 !123456789/);
  assert.doesNotMatch(embed.description, /OVR|#12/);
  assert.match(embed.description, /#\s+PLAYER\s+RARITY/);
});
