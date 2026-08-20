import assert from "node:assert/strict";
import test from "node:test";

import { compareCommand } from "../src/bot/commands/compare.command.js";

function card(id, playerName, stats) {
  return Object.freeze({
    cardTemplateId: String(id),
    playerName,
    rarityCode: id === 1 ? "GOAT" : "ALPHA",
    rarityName: id === 1 ? "Goat" : "Alpha",
    primaryPosition: "SG",
    secondaryPosition: "SF",
    heightCm: 198,
    totalMinted: "1",
    ...stats,
  });
}

const cards = new Map([
  ["1", card(1, "Kobe Bryant", {
    threePoint: 97, midRange: 96, finishing: 97, playmaking: 90,
    interiorDefense: 92, perimeterDefense: 95, strength: 84,
  })],
  ["2", card(2, "Jimmy Butler", {
    threePoint: 84, midRange: 88, finishing: 91, playmaking: 82,
    interiorDefense: 86, perimeterDefense: 94, strength: 88,
  })],
]);

test("compare command renders two Cards with actual stat differences", async () => {
  const replies = [];
  const interaction = {
    user: { id: "234567890123456789", username: "CompareTester" },
    options: {
      getString(name) { return name === "card_a" ? "template:1" : "template:2"; },
    },
    async deferReply() {},
    async editReply(payload) { replies.push(payload); },
  };
  const services = {
    cardView: {
      async getTemplate(id) { return cards.get(String(id)); },
    },
  };

  await compareCommand.execute(interaction, { services });

  const payload = replies[0];
  const embed = payload.embeds[0].toJSON();
  assert.equal(embed.title, "CARD COMPARISON");
  assert.match(embed.description, /Kobe Bryant/);
  assert.match(embed.description, /Jimmy Butler/);
  assert.match(embed.description, /A \+13/);
  assert.equal(payload.components[0].components.length, 3);
  assert.equal(payload.files[0].name, "card-comparison.png");
});

test("compare autocomplete offers the shared Card catalog", async () => {
  let choices;
  await compareCommand.autocomplete({
    options: { getFocused() { return "kob"; } },
    async respond(value) { choices = value; },
  }, { services: {
    cardView: { async searchTemplates() { return [cards.get("1")]; } },
  } });
  assert.deepEqual(choices, [{ name: "Kobe Bryant — Goat", value: "template:1" }]);
});
