import assert from "node:assert/strict";
import test from "node:test";

import { lineupCommand } from "../src/bot/commands/lineup.command.js";

test("lineup set command assigns a Card Instance to a slot", async () => {
  const replies = [];
  const interaction = {
    user: { id: "234567890123456789", username: "LineupTester" },
    options: {
      getSubcommand() {
        return "set";
      },
      getString(name) {
        return name === "slot" ? "PG" : "42";
      },
    },
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
        return { playerId: "7" };
      },
    },
    lineup: {
      async setCard(input) {
        assert.deepEqual(input, {
          playerId: "7",
          slot: "PG",
          cardInstanceId: "42",
        });
        return {
          complete: false,
          slots: [
            {
              slot: "PG",
              cardInstanceId: "42",
              playerName: "Test Guard",
              edition: "Base",
              rarityCode: "COMMON",
              overall: 85,
              cardLevel: 3,
              serialNumber: "4",
            },
            ...["SG", "SF", "PF", "C"].map((slot) => ({
              slot,
              cardInstanceId: null,
            })),
          ],
        };
      },
    },
  };

  await lineupCommand.execute(interaction, { services });

  assert.equal(replies[0].type, "defer");
  const embed = replies[1].payload.embeds[0].toJSON();
  assert.match(embed.description, /Test Guard/);
  assert.match(embed.footer.text, /1\/5/);
});
