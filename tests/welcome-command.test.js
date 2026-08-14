import assert from "node:assert/strict";
import test from "node:test";

import { welcomeCommand } from "../src/bot/commands/welcome.command.js";
import { welcomeComponent } from "../src/bot/components/welcome.component.js";
import { createWelcomePayload } from "../src/bot/presenters/welcome.presenter.js";

const starterCards = ["PG", "SG", "SF", "PF", "C"].map((slot, index) => ({
  slot,
  playerName: `${slot} Starter`,
  rarityName: "Base",
  cardLevel: 1,
  publicCardId: String(100_000_001 + index),
}));

test("welcome payload shows five starters, Guide, and Community link", () => {
  const payload = createWelcomePayload({
    viewerDiscordUserId: "234567890123456789",
    displayName: "Rookie",
    botAvatarUrl: "https://cdn.discordapp.com/avatar.png",
    communityInviteUrl: "https://discord.gg/slamdunk",
    result: { alreadyGranted: false, cards: starterCards },
  });
  const embed = payload.embeds[0].toJSON();
  assert.match(embed.fields[0].value, /PG Starter/);
  assert.match(embed.fields[0].value, /C Starter/);
  assert.equal(embed.fields.some((field) => field.name === "Why Play?"), false);
  assert.doesNotMatch(embed.fields[1].value, /\*\*[1-4]\.\*\*/);
  assert.equal(payload.components[0].components.length, 2);
  assert.equal(payload.components[0].components[0].data.label, "Guide");
  assert.equal(payload.components[0].components[1].data.url, "https://discord.gg/slamdunk");
});

test("welcome command grants once through onboarding and sends a DM", async () => {
  let dmPayload;
  let response;
  let grantInput;
  const interaction = {
    id: "welcome-interaction-1",
    user: {
      id: "234567890123456789",
      username: "rookie",
      globalName: "Rookie",
      async send(payload) { dmPayload = payload; },
    },
    client: { user: { displayAvatarURL: () => "https://cdn.discordapp.com/bot.png" } },
    async deferReply() {},
    async editReply(payload) { response = payload; },
  };
  await welcomeCommand.execute(interaction, {
    communityInviteUrl: "https://discord.gg/slamdunk",
    services: {
      player: {
        async getOrCreatePlayer() { return { playerId: "10" }; },
      },
      onboarding: {
        async grantStarterLineup(input) {
          grantInput = input;
          return { alreadyGranted: false, cards: starterCards };
        },
      },
    },
  });

  assert.deepEqual(grantInput, { playerId: "10", interactionId: "welcome-interaction-1" });
  assert.equal(dmPayload.embeds.length, 1);
  assert.match(response.content, /Direct Messages/);
});

test("welcome Guide button sends the tabbed Manual", async () => {
  let reply;
  await welcomeComponent.execute({
    customId: "welcome:guide:234567890123456789",
    user: { id: "234567890123456789" },
    async reply(payload) { reply = payload; },
  });
  assert.equal(reply.embeds.length, 1);
  assert.equal(reply.components[0].components.length, 4);
});
