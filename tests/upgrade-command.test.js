import assert from "node:assert/strict";
import test from "node:test";

import { upgradeCommand } from "../src/bot/commands/upgrade.command.js";

function createInteraction(subcommand, values) {
  const replies = [];
  return {
    replies,
    interaction: {
      user: { id: "234567890123456789", username: "UpgradeTester" },
      options: {
        getSubcommand() {
          return subcommand;
        },
        getString(name) {
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

test("upgrade fusion command combines two Card Instances", async () => {
  const { interaction, replies } = createInteraction("fusion", {
    card_a: "41",
    card_b: "42",
  });
  const services = {
    collection: {
      async resolveOwnedCardReference({ cardReference }) {
        return cardReference;
      },
    },
    player: {
      async getOrCreatePlayer() {
        return { playerId: "7" };
      },
    },
    upgrade: {
      async fuseCards(input) {
        assert.deepEqual(input, {
          playerId: "7",
          sourceCardAId: "41",
          sourceCardBId: "42",
        });
        return {
          sourceCards: [
            {
              cardInstanceId: "41",
              serialNumber: "1",
              cardLevel: 2,
              playerName: "Test Guard",
            },
            { cardInstanceId: "42", serialNumber: "2", cardLevel: 4 },
          ],
          resultCard: {
            cardInstanceId: "43",
            publicCardId: "123456789",
            serialNumber: "3",
            cardLevel: 5,
          },
        };
      },
    },
  };

  await upgradeCommand.execute(interaction, { services });

  assert.equal(replies[0].type, "defer");
  const embed = replies[1].payload.embeds[0].toJSON();
  assert.match(embed.title, /Fusion Complete/);
  assert.match(embed.fields[1].value, /Lv5/);
});

test("upgrade item command consumes one Level Up item", async () => {
  const { interaction, replies } = createInteraction("item", { card_id: "43" });
  const services = {
    collection: {
      async resolveOwnedCardReference({ cardReference }) {
        return cardReference;
      },
    },
    player: {
      async getOrCreatePlayer() {
        return { playerId: "7" };
      },
    },
    upgrade: {
      async useLevelUpItem(input) {
        assert.deepEqual(input, { playerId: "7", cardInstanceId: "43" });
        return {
          card: {
            cardInstanceId: "43",
            publicCardId: "123456789",
            playerName: "Test Guard",
          },
          previousLevel: 2,
          newLevel: 3,
          itemName: "Level Up",
          remainingItems: 1,
        };
      },
    },
  };

  await upgradeCommand.execute(interaction, { services });

  const embed = replies[1].payload.embeds[0].toJSON();
  assert.match(embed.title, /Card Upgraded/);
  assert.equal(embed.fields[0].value, "2 → 3");
  assert.match(embed.fields[1].name, /Level Up/);
});
