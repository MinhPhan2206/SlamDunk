import assert from "node:assert/strict";
import test from "node:test";

import { cooldownsCommand } from "../src/bot/commands/cooldowns.command.js";
import { rarityCommand } from "../src/bot/commands/rarity.command.js";

function createInteraction({ rarityTier = 5 } = {}) {
  const replies = [];

  return {
    user: { id: "234567890123456789", username: "SupportTester" },
    options: {
      getInteger(name, required) {
        assert.equal(name, "tier");
        assert.equal(required, true);
        return rarityTier;
      },
    },
    replies,
    async deferReply() {
      replies.push({ type: "defer" });
    },
    async editReply(payload) {
      replies.push({ type: "edit", payload });
    },
  };
}

test("cooldowns command reports the implemented Claim cooldown", async () => {
  const interaction = createInteraction();
  const availableAt = new Date("2030-01-01T00:30:00.000Z");
  const services = {
    player: {
      async getOrCreatePlayer(input) {
        assert.deepEqual(input, {
          discordUserId: interaction.user.id,
          usernameSnapshot: interaction.user.username,
        });
        return { playerId: "1" };
      },
    },
    reward: {
      async getClaimCooldown(playerId) {
        assert.equal(playerId, "1");
        return {
          cooldownType: "CLAIM",
          available: false,
          availableAt,
        };
      },
    },
  };

  await cooldownsCommand.execute(interaction, { services });

  assert.equal(interaction.replies[0].type, "defer");
  assert.match(interaction.replies[1].payload.content, /Cooldowns/);
  assert.match(interaction.replies[1].payload.content, /Claim/);
  assert.match(
    interaction.replies[1].payload.content,
    new RegExp(`<t:${Math.floor(availableAt.getTime() / 1_000)}:R>`),
  );
});

test("rarity command lists Card Templates for the requested tier", async () => {
  const interaction = createInteraction({ rarityTier: 7 });
  const services = {
    cardTemplate: {
      async listTemplatesByRarity(rarityTier) {
        assert.equal(rarityTier, 7);
        return {
          rarityTier,
          templates: [
            {
              playerName: "Test Legend",
              edition: "Hall of Fame",
              season: null,
              overall: 99,
              primaryPosition: "SG",
              secondaryPosition: null,
            },
          ],
          total: "1",
        };
      },
    },
  };

  await rarityCommand.execute(interaction, { services });

  assert.equal(interaction.replies[0].type, "defer");
  const embed = interaction.replies[1].payload.embeds[0].toJSON();
  assert.match(embed.title, /Tier 7/);
  assert.match(embed.title, /Hall of Fame/);
  assert.match(embed.description, /Test Legend/);
  assert.match(embed.description, /OVR 99/);
});

test("rarity command explains when a tier has no Card Templates", async () => {
  const interaction = createInteraction({ rarityTier: 2 });
  const services = {
    cardTemplate: {
      async listTemplatesByRarity() {
        return { rarityTier: 2, templates: [], total: "0" };
      },
    },
  };

  await rarityCommand.execute(interaction, { services });

  const embed = interaction.replies[1].payload.embeds[0].toJSON();
  assert.match(embed.description, /No Card Templates/);
});
