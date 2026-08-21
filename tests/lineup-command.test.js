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
          currentWinStreak: 2,
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
          lineup: { lineupNumber: 1 },
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
              heightCm: 190,
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
  assert.equal(replies[1].payload.embeds.length, 1);
  assert.equal(embed.description, undefined);
  assert.equal(embed.thumbnail, undefined);
  assert.equal(embed.title, "LINEUPTESTER'S LINEUP 1");
  assert.match(embed.footer.text, /1\/5/);
  assert.match(embed.fields[0].value, /80\.0/);
  assert.match(embed.fields[1].value, /HEIGHT.*6'3\"/s);
  assert.match(embed.fields[2].value, /6W – 4L/);
  assert.match(embed.fields[2].value, /60\.0%/);
  assert.match(embed.fields[2].value, /2.*Streak/);
  assert.match(embed.footer.text, /Missing SG, SF, PF, C/);
  assert.equal(replies[1].payload.files[0].name, "lineup.png");
});

test("lineup swap activates one of three saved lineups", async () => {
  const replies = [];
  const interaction = {
    user: { id: "234567890123456789", username: "LineupTester" },
    options: {
      getSubcommand() { return "swap"; },
      getInteger(name, required) {
        assert.equal(name, "lineup");
        assert.equal(required, true);
        return 3;
      },
    },
    async deferReply() {},
    async editReply(payload) { replies.push(payload); },
  };
  await lineupCommand.execute(interaction, {
    services: {
      player: {
        async getOrCreatePlayer() {
          return {
            playerId: "7",
            gamesPlayed: 0,
            gamesWon: 0,
            gamesLost: 0,
            currentWinStreak: 0,
          };
        },
      },
      lineup: {
        async swapActiveLineup(input) {
          assert.deepEqual(input, { playerId: "7", lineupNumber: 3 });
          return {
            lineup: { lineupNumber: 3 },
            complete: false,
            slots: ["PG", "SG", "SF", "PF", "C"].map((slot) => ({
              slot,
              cardInstanceId: null,
            })),
          };
        },
      },
    },
  });
  const embed = replies[0].embeds[0].toJSON();
  assert.equal(embed.title, "LINEUPTESTER'S LINEUP 3");
});
