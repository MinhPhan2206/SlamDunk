import assert from "node:assert/strict";
import test from "node:test";

import { cooldownsCommand } from "../src/bot/commands/cooldowns.command.js";
import { rarityCommand } from "../src/bot/commands/rarity.command.js";

function createInteraction({
  rarityCode = "ALL_STAR",
  position = null,
  sortBy = null,
} = {}) {
  const replies = [];

  return {
    user: { id: "234567890123456789", username: "SupportTester" },
    options: {
      getString(name, required) {
        if (name === "rarity") {
          assert.equal(required, true);
          return rarityCode;
        }
        if (name === "position") return position;
        if (name === "sort_by") return sortBy;
        throw new Error(`Unexpected option: ${name}`);
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
          charges: 0,
          maximumCharges: 2,
          nextChargeAt: availableAt,
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
      async getWeeklyCooldown(playerId) {
        assert.equal(playerId, "1");
        return {
          cooldownType: "WEEKLY",
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
          charges: 2,
          maximumCharges: 2,
          nextChargeAt: null,
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
  assert.equal(embed.title, "COOLDOWNS");
  assert.equal(embed.fields[0].name, "CLAIM");
  assert.equal(embed.fields[2].name, "WEEKLY");
  assert.equal(embed.fields[3].name, "FREE DROP");
  assert.equal(embed.fields[4].name, "BATTLE");
  assert.match(
    embed.fields[0].value,
    new RegExp(`<t:${Math.floor(availableAt.getTime() / 1_000)}:R>`),
  );
  assert.match(embed.fields[0].value, /0\/2 charges/);
  assert.equal(embed.fields[3].value, "2/2 charges · Ready");
});

test("rarity command filters and sorts paginated Card Templates", async () => {
  const interaction = createInteraction({
    rarityCode: "GOAT",
    position: "SG",
    sortBy: "three_point",
  });
  const services = {
    cardTemplate: {
      async listTemplatesByRarity(rarityCode, options) {
        assert.equal(rarityCode, "GOAT");
        assert.deepEqual(options, {
          position: "SG",
          sortBy: "three_point",
          page: 1,
        });
        return {
          rarityCode,
          templates: [
            {
              playerName: "Test Legend",
              overall: 99,
              primaryPosition: "SG",
              secondaryPosition: null,
              threePoint: 99,
            },
          ],
          total: 11,
          page: 1,
          totalPages: 2,
          position: "SG",
          sortBy: "three_point",
          sortLabel: "3 Point",
        };
      },
    },
  };

  await rarityCommand.execute(interaction, { services });

  assert.equal(interaction.replies[0].type, "defer");
  const embed = interaction.replies[1].payload.embeds[0].toJSON();
  assert.equal(embed.title, "CARD RESULTS");
  assert.match(embed.description, /Test Legend/);
  assert.doesNotMatch(embed.description, /OVR/);
  assert.match(embed.description, /SG/);
  assert.match(embed.description, /3PT/);
  assert.match(embed.description, /99/);
  assert.equal(embed.footer.text, "Page 1 of 2\nRequested by SupportTester");
  assert.equal(interaction.replies[1].payload.components.length, 1);
});

test("rarity command explains when a rarity has no Card Templates", async () => {
  const interaction = createInteraction({ rarityCode: "COMMON" });
  const services = {
    cardTemplate: {
      async listTemplatesByRarity() {
        return {
          rarityCode: "COMMON",
          templates: [],
          total: 0,
          page: 1,
          totalPages: 0,
          position: null,
          sortBy: "alphabet",
          sortLabel: "Alphabetical",
        };
      },
    },
  };

  await rarityCommand.execute(interaction, { services });

  const embed = interaction.replies[1].payload.embeds[0].toJSON();
  assert.match(embed.description, /No Card Templates/);
});
