import assert from "node:assert/strict";
import test from "node:test";

import { cardCommand } from "../src/bot/commands/card.command.js";
import { cardComponent } from "../src/bot/components/card.component.js";
import { createInteractionCreateHandler } from "../src/bot/events/interaction-create.event.js";

function card(overrides = {}) {
  return {
    cardInstanceId: "10",
    publicCardId: "123456789",
    cardTemplateId: "20",
    playerName: "Test Player",
    primaryPosition: "PG",
    secondaryPosition: "SG",
    rarityCode: "ALPHA",
    rarityName: "Alpha",
    cardLevel: 3,
    userLock: false,
    ownerDiscordUserId: "805986648973770783",
    ownerUsername: "nbaase",
    heightCm: 198,
    totalMinted: "14",
    actualStats: {
      threePoint: 87,
      midRange: 86,
      finishing: 85,
      playmaking: 88,
      interiorDefense: 70,
      perimeterDefense: 82,
      strength: 75,
    },
    ...overrides,
  };
}

test("/card resolves a public Card ID and renders Stats tabs", async () => {
  let reply;
  const interaction = {
    user: { id: "805986648973770783", username: "CardTester" },
    options: { getString: () => "!123456789" },
    async deferReply() {},
    async editReply(payload) { reply = payload; },
  };
  await cardCommand.execute(interaction, {
    services: {
      cardView: {
        async getInstanceByPublicId(value) {
          assert.equal(value, "123456789");
          return card();
        },
      },
    },
  });

  const embed = reply.embeds[0].toJSON();
  assert.equal(embed.title, "◆ ALPHA ◆");
  assert.match(embed.description, /TEST PLAYER/);
  assert.match(embed.description, /Position · \*\*PG\/SG\*\*/);
  assert.match(embed.description, /Height · \*\*6'6"\*\*/);
  assert.match(embed.description, /3 Point Shooting · \*\*87\*\*/);
  assert.match(embed.description, /\*\*CARD LEVEL\*\* · \*\*3\*\*/);
  assert.match(embed.description, /Obtained · \*\*14\*\*/);
  assert.match(embed.description, /Serial · \*\*!123456789\*\*/);
  assert.match(embed.description, /Owned by <@805986648973770783>/);
  assert.deepEqual(embed.fields ?? [], []);
  assert.doesNotMatch(JSON.stringify(embed), /OVR|Market Estimate/i);
  assert.equal(reply.components[0].components.length, 4);
  assert.equal(reply.components[0].components[0].data.disabled, true);
  assert.deepEqual(
    reply.components[0].components.map((button) => button.data.emoji.name),
    ["📊", "✨", "🏀", "🖼️"],
  );
  assert.equal(embed.thumbnail.url, "attachment://card.png");
  assert.equal(reply.files[0].name, "card.png");
  assert.deepEqual(reply.attachments, []);
});

test("Card Image tab shows only the full Card artwork", async () => {
  let reply;
  await cardComponent.execute({
    customId: "card:805986648973770783:instance:10:image",
    user: { id: "805986648973770783" },
    async deferUpdate() {},
    async editReply(payload) { reply = payload; },
  }, {
    services: {
      cardView: { async getInstance() { return card(); } },
    },
  });

  const embed = reply.embeds[0].toJSON();
  assert.equal(embed.title, undefined);
  assert.equal(embed.description, undefined);
  assert.equal(embed.image.url, "attachment://card.png");
  assert.equal(reply.files[0].name, "card.png");
  assert.equal(reply.components[0].components[3].data.disabled, true);
});

test("/card resolves a collection position for the invoking Player", async () => {
  const calls = [];
  const interaction = {
    user: { id: "805986648973770783", username: "CardTester" },
    options: { getString: () => "2" },
    async deferReply() {},
    async editReply() {},
  };
  await cardCommand.execute(interaction, {
    services: {
      player: { async getOrCreatePlayer() { return { playerId: "8" }; } },
      collection: {
        async resolveOwnedCardReference(input) {
          calls.push(input);
          return "10";
        },
      },
      cardView: { async getInstance(id) { assert.equal(id, "10"); return card(); } },
    },
  });
  assert.deepEqual(calls, [{ playerId: "8", cardReference: "2" }]);
});

test("/card autocomplete is routed and returns player plus rarity choices", async () => {
  let choices;
  const interaction = {
    commandName: "card",
    responded: false,
    options: { getFocused: () => "test" },
    isAutocomplete: () => true,
    async respond(value) { choices = value; this.responded = true; },
  };
  const handler = createInteractionCreateHandler(
    new Map([["card", cardCommand]]),
    {
      services: {
        cardView: {
          async searchTemplates(query) {
            assert.equal(query, "test");
            return [card()];
          },
        },
      },
    },
  );
  await handler(interaction);
  assert.deepEqual(choices, [{ name: "Test Player — Alpha", value: "template:20" }]);
});

test("Card Battle Stats tab is vertical and restricted to the original viewer", async () => {
  let reply;
  const services = {
    cardView: {
      async getInstance() { return card(); },
      async getBattleStats() {
        return {
          gamesPlayed: 0,
          pointsPerGame: 0,
          reboundsPerGame: 0,
          assistsPerGame: 0,
          stealsPerGame: 0,
          blocksPerGame: 0,
          turnoversPerGame: 0,
          fieldGoalPercentage: 0,
          threePointPercentage: 0,
        };
      },
    },
  };
  await cardComponent.execute({
    customId: "card:805986648973770783:instance:10:battle",
    user: { id: "805986648973770783" },
    async deferUpdate() {},
    async editReply(payload) { reply = payload; },
  }, { services });
  const value = reply.embeds[0].toJSON().fields[0].value;
  assert.match(value, /GP\s+0\nPPG\s+0\.0/);
  assert.match(value, /FG%\s+0\.0%\n3PT%\s+0\.0%/);
  assert.equal(reply.embeds[0].toJSON().thumbnail, undefined);
  assert.deepEqual(reply.attachments, []);
  assert.equal(reply.files, undefined);

  let denied;
  await cardComponent.execute({
    customId: "card:805986648973770783:instance:10:traits",
    user: { id: "870564045441363998" },
    async reply(payload) { denied = payload; },
  }, { services });
  assert.match(denied.content, /Only the user/);
});

test("Card Traits tab groups Traits and mentions the owner", async () => {
  let reply;
  await cardComponent.execute({
    customId: "card:805986648973770783:instance:10:traits",
    user: { id: "805986648973770783" },
    async deferUpdate() {},
    async editReply(payload) { reply = payload; },
  }, {
    services: {
      cardView: {
        async getInstance() { return card(); },
        async getTraits() {
          return [
            { traitName: "Catch & Shoot", traitType: "SHOOTING", traitTier: 4, traitTierLabel: "IV" },
            { traitName: "Floor General", traitType: "PLAYMAKING", traitTier: 3, traitTierLabel: "III" },
            { traitName: "Rim Protector", traitType: "DEFENSE", traitTier: 2, traitTierLabel: "II" },
            { traitName: "Glass Cleaner", traitType: "REBOUNDING", traitTier: 2, traitTierLabel: "II" },
            { traitName: "Clutch Gene", traitType: "CLUTCH", traitTier: 5, traitTierLabel: "V" },
          ];
        },
      },
    },
  });

  const embed = reply.embeds[0].toJSON();
  assert.match(embed.description, /Owned by <@805986648973770783>/);
  assert.deepEqual(embed.fields.map((field) => field.name), [
    "⚔️ OFFENSE",
    "🎯 PLAYMAKING",
    "🛡️ DEFENSE",
    "💪 PHYSICAL & REBOUNDING",
    "⏱️ SITUATIONAL & CLUTCH",
  ]);
  assert.match(embed.fields[0].value, /Catch & Shoot.*IV/);
  assert.equal(embed.thumbnail, undefined);
  assert.deepEqual(reply.attachments, []);
  assert.equal(reply.files, undefined);
});

test("Template view exposes Stats and Traits without Battle Stats", async () => {
  let reply;
  await cardCommand.execute({
    user: { id: "805986648973770783", username: "CardTester" },
    options: { getString: () => "template:20" },
    async deferReply() {},
    async editReply(payload) { reply = payload; },
  }, {
    services: {
      cardView: {
        async getTemplate() {
          const template = card({ cardInstanceId: undefined, publicCardId: undefined, cardLevel: undefined });
          delete template.actualStats;
          return template;
        },
      },
    },
  });
  assert.equal(reply.components[0].components.length, 3);
  assert.ok(reply.components[0].components[2].data.custom_id.endsWith(":image"));
  assert.ok(reply.components[0].components.every((button) =>
    !button.data.custom_id.endsWith(":battle")
  ));
});
