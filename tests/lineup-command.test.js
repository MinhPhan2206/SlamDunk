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
    collection: {
      async resolveOwnedCardReference(input) {
        assert.deepEqual(input, { playerId: "7", cardReference: "42" });
        return "42";
      },
    },
    player: {
      async getOrCreatePlayer() {
        return {
          playerId: "7",
          gamesPlayed: 10,
          gamesWon: 6,
          gamesLost: 4,
        };
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
              publicCardId: "123456789",
              playerName: "Test Guard",
              rarityCode: "COMMON",
              cardLevel: 3,
              serialNumber: "4",
              actualStats: {
                threePoint: 80,
                midRange: 79,
                finishing: 82,
                playmaking: 84,
                perimeterDefense: 78,
                interiorDefense: 70,
                strength: 75,
              },
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
  assert.match(embed.fields[0].value, /80\.0/);
  assert.match(embed.fields[2].value, /60\.0% Win Rate/);
  assert.equal(replies[1].payload.files[0].name, "lineup.png");
});
