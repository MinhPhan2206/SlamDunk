import assert from "node:assert/strict";
import test from "node:test";

import { upgradeComponent } from "../src/bot/components/upgrade.component.js";
import {
  levelUpCommand,
  upgradeCommand,
} from "../src/bot/commands/upgrade.command.js";

const VIEWER_ID = "234567890123456789";
const group = Object.freeze({
  cardTemplateId: "5",
  playerName: "Test Guard",
  rarityCode: "ALPHA",
  rarityName: "Alpha",
  primaryPosition: "PG",
  secondaryPosition: "SG",
  cardCount: 3,
});
const cards = Object.freeze([
  { ...group, cardInstanceId: "41", publicCardId: "111111111", cardLevel: 1 },
  { ...group, cardInstanceId: "42", publicCardId: "222222222", cardLevel: 2 },
  { ...group, cardInstanceId: "43", publicCardId: "333333333", cardLevel: 2 },
]);

function createCommandInteraction(values = {}) {
  const replies = [];
  return {
    replies,
    interaction: {
      user: { id: VIEWER_ID, username: "UpgradeTester" },
      options: { getString(name) { return values[name]; } },
      async deferReply() { replies.push({ type: "defer" }); },
      async editReply(payload) { replies.push({ type: "edit", payload }); },
    },
  };
}

function componentInteraction(customId, values = []) {
  const edits = [];
  return {
    edits,
    interaction: {
      customId,
      values,
      user: { id: VIEWER_ID, username: "UpgradeTester" },
      async deferUpdate() {},
      async editReply(payload) { edits.push(payload); },
    },
  };
}

function baseServices(upgrade) {
  return {
    collection: {
      async resolveOwnedCardReference({ cardReference }) { return cardReference; },
    },
    player: {
      async getOrCreatePlayer() { return { playerId: "7" }; },
    },
    upgrade,
  };
}

test("Upgrade actions use separate slash command names", () => {
  assert.equal(upgradeCommand.data.name, "upgrade");
  assert.equal(upgradeCommand.data.options.length, 0);
  assert.equal(levelUpCommand.data.name, "level-up");
});

test("upgrade command opens a dropdown of eligible players", async () => {
  const { interaction, replies } = createCommandInteraction();
  await upgradeCommand.execute(interaction, { services: baseServices({
    async listFusionOptions(input) {
      assert.deepEqual(input, { playerId: "7" });
      return [group];
    },
  }) });

  assert.equal(replies[0].type, "defer");
  assert.equal(replies[1].payload.embeds[0].toJSON().title, "SELECT PLAYER");
  assert.equal(replies[1].payload.components[0].components[0].data.type, 3);
});

test("level-up command requires confirmation before consuming an item", async () => {
  const { interaction, replies } = createCommandInteraction({ card_id: "43" });
  await levelUpCommand.execute(interaction, { services: baseServices({
    async previewLevelUp(input) {
      assert.deepEqual(input, { playerId: "7", cardInstanceId: "43" });
      return { card: cards[2], previousLevel: 2, newLevel: 3 };
    },
  }) });

  const payload = replies[1].payload;
  assert.equal(payload.embeds[0].toJSON().title, "LEVEL UP REVIEW");
  assert.doesNotMatch(payload.embeds[0].toJSON().description, /remaining|Items/i);
  assert.equal(payload.components[0].components.length, 2);
});

test("level-up Confirm performs the mutation", async () => {
  const { interaction, edits } = componentInteraction(
    `upgrade:level_confirm:${VIEWER_ID}:43`,
  );
  await upgradeComponent.execute(interaction, { services: baseServices({
    async useLevelUpItem(input) {
      assert.deepEqual(input, { playerId: "7", cardInstanceId: "43" });
      return {
        card: cards[2], previousLevel: 2, newLevel: 3,
        itemName: "Level Up", remainingItems: 1,
      };
    },
  }) });
  assert.equal(edits[0].embeds[0].toJSON().title, "UPGRADE COMPLETE");
});

test("Fusion supports three selected materials and confirms atomically", async () => {
  const previewFusionMaterials = async (input) => {
    assert.equal(input.playerId, "7");
    assert.equal(input.cardTemplateId, "5");
    return { group, cards };
  };
  const selection = componentInteraction(
    `upgrade:materials_select:${VIEWER_ID}:5`,
    ["41", "42", "43"],
  );
  await upgradeComponent.execute(selection.interaction, { services: baseServices({
    previewFusionMaterials,
  }) });

  const reviewPayload = selection.edits[0];
  const review = reviewPayload.embeds[0].toJSON();
  assert.equal(review.title, "FUSION REVIEW");
  assert.equal(review.fields[0].value.split("\n").length, 3);
  assert.equal(review.fields[1].value, "Lv.5 · New Card ID");
  assert.doesNotMatch(review.description, /consumed/i);

  const confirmId = reviewPayload.components[0].components[0].data.custom_id;
  const confirmation = componentInteraction(confirmId);
  await upgradeComponent.execute(confirmation.interaction, { services: baseServices({
    async fuseCards(input) {
      assert.deepEqual(input, {
        playerId: "7",
        sourceCardIds: ["41", "42", "43"],
      });
      return {
        sourceCards: cards,
        resultCard: { publicCardId: "444444444", cardLevel: 5 },
      };
    },
  }) });
  assert.equal(confirmation.edits[0].embeds[0].toJSON().title, "FUSION COMPLETE");
});
