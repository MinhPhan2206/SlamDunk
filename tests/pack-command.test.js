import assert from "node:assert/strict";
import test from "node:test";

import { packCommand } from "../src/bot/commands/pack.command.js";
import { packSelectionComponent } from "../src/bot/components/pack-selection.component.js";
import { createInteractionCreateHandler } from "../src/bot/events/interaction-create.event.js";

function template(cardTemplateId, playerName) {
  return {
    cardTemplateId,
    playerName,
    edition: "Base",
    rarityTier: 3,
    overall: 82,
    primaryPosition: "SF",
    secondaryPosition: "PF",
  };
}

function offer() {
  return {
    session: { packSessionId: "10", status: "OPEN" },
    candidates: [
      { candidatePosition: 1, cardTemplateId: "1", template: template("1", "Alpha") },
      { candidatePosition: 2, cardTemplateId: "2", template: template("2", "Beta") },
      { candidatePosition: 3, cardTemplateId: "3", template: template("3", "Gamma") },
    ],
    resultInstance: null,
  };
}

test("pack command displays three persisted choices", async () => {
  const replies = [];
  const interaction = {
    id: "123456789012345678",
    user: { id: "234567890123456789", username: "PackTester" },
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
        return { playerId: "5" };
      },
    },
    pack: {
      async createFreeDropOffer(input) {
        assert.deepEqual(input, {
          playerId: "5",
          interactionId: interaction.id,
        });
        return offer();
      },
    },
  };

  await packCommand.execute(interaction, { services });

  assert.equal(replies[0].type, "defer");
  assert.equal(replies[1].payload.components[0].components.length, 3);
  assert.equal(
    replies[1].payload.components[0].components[1].data.custom_id,
    "pack:select:10:2",
  );
});

test("pack selection component edits the offer with the minted card", async () => {
  const replies = [];
  const interaction = {
    customId: "pack:select:10:2",
    user: { id: "234567890123456789", username: "PackTester" },
    async deferUpdate() {
      replies.push({ type: "deferUpdate" });
    },
    async editReply(payload) {
      replies.push({ type: "edit", payload });
    },
    async followUp(payload) {
      replies.push({ type: "followUp", payload });
    },
  };
  const selectedTemplate = template("2", "Beta");
  const services = {
    player: {
      async getOrCreatePlayer() {
        return { playerId: "5" };
      },
    },
    pack: {
      async confirmFreeDropSelection(input) {
        assert.deepEqual(input, {
          playerId: "5",
          packSessionId: "10",
          candidatePosition: 2,
        });
        return {
          session: { selectedTemplateId: "2", status: "COMPLETED" },
          candidates: [
            {
              candidatePosition: 2,
              cardTemplateId: "2",
              template: selectedTemplate,
            },
          ],
          resultInstance: { cardLevel: 4, serialNumber: "12" },
        };
      },
    },
  };

  await packSelectionComponent.execute(interaction, { services });

  assert.equal(replies[0].type, "deferUpdate");
  assert.equal(replies[1].payload.components.length, 0);
  const embed = replies[1].payload.embeds[0].toJSON();
  assert.match(embed.description, /Card Level: \*\*4\*\*/);
  assert.match(embed.description, /Serial: \*\*#12\*\*/);
});

test("interaction router dispatches Pack button interactions by namespace", async () => {
  let receivedInteraction;
  const interaction = {
    customId: "pack:select:10:2",
    isChatInputCommand() {
      return false;
    },
    isButton() {
      return true;
    },
  };
  const handler = createInteractionCreateHandler(
    new Map(),
    { services: {} },
    new Map([
      [
        "pack",
        {
          async execute(received) {
            receivedInteraction = received;
          },
        },
      ],
    ]),
  );

  await handler(interaction);

  assert.equal(receivedInteraction, interaction);
});
