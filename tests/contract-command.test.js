import assert from "node:assert/strict";
import test from "node:test";

import { contractCommand } from "../src/bot/commands/contract.command.js";
import { UI_EMOJIS } from "../src/bot/ui/emojis.js";

test("contract command exposes Alpha and All-Star Contract choices", () => {
  const [option] = contractCommand.data.toJSON().options;
  assert.deepEqual(option.choices.map(({ name, value }) => ({ name, value })), [
    { name: "Alpha Contract", value: "alpha" },
    { name: "All-Star Contract", value: "all_star" },
  ]);
});

test("contract command consumes the selected Contract and displays its Card", async () => {
  const replies = [];
  const interaction = {
    id: "1539999999999999999",
    user: { id: "805986648973770783", username: "ContractTester" },
    options: { getString: () => "alpha" },
    async deferReply() {},
    async editReply(payload) { replies.push(payload); },
  };
  await contractCommand.execute(interaction, {
    services: {
      player: { async getOrCreatePlayer() { return { playerId: "7" }; } },
      contract: {
        async openContract(input) {
          assert.deepEqual(input, {
            playerId: "7",
            contractCode: "alpha",
            interactionId: interaction.id,
          });
          return {
            contract: { displayName: "Alpha Contract", itemType: "ALPHA_CONTRACT" },
            template: {
              playerName: "Desmond Bane",
              rarityCode: "ALPHA",
              primaryPosition: "SG",
              secondaryPosition: "SF",
            },
            instance: { cardLevel: 1, publicCardId: "123456789" },
          };
        },
      },
    },
  });
  const embed = replies[0].embeds[0].toJSON();
  assert.equal(embed.title, "CONTRACT SIGNED");
  assert.equal(embed.author.name, "Alpha Contract");
  assert.match(embed.description, /Desmond Bane.*Alpha.*Lv\.1.*123456789/s);
  assert.match(embed.description, new RegExp(UI_EMOJIS.alphaContract.id));
});
