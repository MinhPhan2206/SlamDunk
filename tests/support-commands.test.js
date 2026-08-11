import assert from "node:assert/strict";
import test from "node:test";

import { cooldownsCommand } from "../src/bot/commands/cooldowns.command.js";
import { rarityCommand } from "../src/bot/commands/rarity.command.js";

function createInteraction({ rarityCode = "ALL_STAR" } = {}) {
  const replies = [];

  return {
    user: { id: "234567890123456789", username: "SupportTester" },
    options: {
      getString(name, required) {
        assert.equal(name, "rarity");
        assert.equal(required, true);
        return rarityCode;
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

test("cooldowns command reports Claim and Free Drop cooldowns", async () => {
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
      async getDailyCooldown(playerId) {
        assert.equal(playerId, "1");
        return {
          cooldownType: "DAILY",
          available: true,
          availableAt: null,
        };
      },
    },
    drop: {
      async getCooldown(playerId) {
        assert.equal(playerId, "1");
        return {
          cooldownType: "FREE_DROP",
          available: true,
          availableAt: null,
        };
      },
    },
    battle: {
      async getCooldown(playerId) {
        assert.equal(playerId, "1");
        return {
          cooldownType: "BATTLE",
          available: true,
          availableAt: null,
        };
      },
    },
  };

  await cooldownsCommand.execute(interaction, { services });

  assert.equal(interaction.replies[0].type, "defer");
  const embed = interaction.replies[1].payload.embeds[0].toJSON();
  assert.equal(embed.title, "Cooldowns");
  assert.equal(embed.fields[0].name, "Claim");
  assert.equal(embed.fields[2].name, "Free Drop");
  assert.equal(embed.fields[3].name, "Battle");
  assert.match(
    embed.fields[0].value,
    new RegExp(`<t:${Math.floor(availableAt.getTime() / 1_000)}:R>`),
  );
});

test("rarity command lists Card Templates for the requested rarity", async () => {
  const interaction = createInteraction({ rarityCode: "GOAT" });
  const services = {
    cardTemplate: {
      async listTemplatesByRarity(rarityCode) {
        assert.equal(rarityCode, "GOAT");
        return {
          rarityCode,
          templates: [
            {
              playerName: "Test Legend",
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
  assert.match(embed.title, /Goat/);
  assert.match(embed.description, /Test Legend/);
  assert.doesNotMatch(embed.description, /OVR/);
  assert.match(embed.description, /SG/);
});

test("rarity command explains when a rarity has no Card Templates", async () => {
  const interaction = createInteraction({ rarityCode: "COMMON" });
  const services = {
    cardTemplate: {
      async listTemplatesByRarity() {
        return { rarityCode: "COMMON", templates: [], total: "0" };
      },
    },
  };

  await rarityCommand.execute(interaction, { services });

  const embed = interaction.replies[1].payload.embeds[0].toJSON();
  assert.match(embed.description, /No Card Templates/);
});
