import assert from "node:assert/strict";
import test from "node:test";

import { dropCommand } from "../src/bot/commands/drop.command.js";
import { dropSelectionComponent } from "../src/bot/components/drop-selection.component.js";
import { createInteractionCreateHandler } from "../src/bot/events/interaction-create.event.js";

function template(cardTemplateId, playerName) {
  return {
    cardTemplateId,
    playerName,
    rarityCode: "UNCOMMON",
    overall: 82,
    primaryPosition: "SF",
    secondaryPosition: "PF",
  };
}

function offer() {
  return {
    session: {
      dropSessionId: "10",
      status: "OPEN",
      selectionExpiresAt: new Date(Date.now() + 60_000),
    },
    candidates: [
      { candidatePosition: 1, cardTemplateId: "1", template: template("1", "Alpha") },
      { candidatePosition: 2, cardTemplateId: "2", template: template("2", "Beta") },
      { candidatePosition: 3, cardTemplateId: "3", template: template("3", "Gamma") },
    ],
    resultInstance: null,
  };
}

test("drop command displays three persisted choices", async () => {
  assert.equal(dropCommand.data.name, "drop");
  const replies = [];
  const interaction = {
    id: "123456789012345678",
    user: { id: "234567890123456789", username: "DropTester" },
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
    drop: {
      async createOffer(input) {
        assert.deepEqual(input, {
          playerId: "5",
          interactionId: interaction.id,
        });
        return offer();
      },
    },
  };

  await dropCommand.execute(interaction, { services });

  assert.equal(replies[0].type, "defer");
  assert.equal(replies[1].payload.components[0].components.length, 3);
  assert.equal(
    replies[1].payload.components[0].components[1].data.custom_id,
    "drop:select:10:2",
  );
  assert.equal(replies[1].payload.files[0].name, "drop-candidates.png");
  assert.equal(replies[1].payload.files[0].attachment.readUInt32BE(16), 800);
  assert.equal(
    replies[1].payload.embeds[0].toJSON().footer.text,
    "Choose within 20 seconds · Card 1 is selected on timeout",
  );
});

test("drop selection component edits the offer with the minted card", async () => {
  const replies = [];
  const interaction = {
    customId: "drop:select:10:2",
    user: { id: "234567890123456789", username: "DropTester" },
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
    drop: {
      async confirmSelection(input) {
        assert.deepEqual(input, {
          playerId: "5",
          dropSessionId: "10",
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
          resultInstance: {
            cardLevel: 4,
            serialNumber: "12",
            publicCardId: "123456789",
          },
        };
      },
    },
  };

  await dropSelectionComponent.execute(interaction, { services });

  assert.equal(replies[0].type, "deferUpdate");
  assert.equal(replies[1].payload.components.length, 0);
  const embed = replies[1].payload.embeds[0].toJSON();
  assert.match(embed.description, /Lv\.4/);
  assert.match(embed.description, /!123456789/);
  assert.doesNotMatch(embed.description, /OVR|Serial/);
});

test("interaction router dispatches Drop button interactions by namespace", async () => {
  let receivedInteraction;
  const interaction = {
    customId: "drop:select:10:2",
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
        "drop",
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
