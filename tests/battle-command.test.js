import assert from "node:assert/strict";
import test from "node:test";

import { battleCommand } from "../src/bot/commands/battle.command.js";

test("battle command displays score and player points", async () => {
  const replies = [];
  const interaction = {
    id: "123456789012345678",
    user: { id: "234567890123456789", username: "BattleTester" },
    async deferReply() {
      replies.push({ type: "defer" });
    },
    async editReply(payload) {
      replies.push({ type: "edit", payload });
    },
  };
  const team = (teamNumber, teamName, finalScore) => ({
    teamNumber,
    teamName,
    finalScore,
    players: ["PG", "SG", "SF", "PF", "C"].map((slot, index) => ({
      slot,
      cardName: `${teamName} ${slot}`,
      cardLevel: 3,
      points: index === 0 ? finalScore - 40 : 10,
    })),
  });
  const services = {
    player: {
      async getOrCreatePlayer() {
        return { playerId: "9" };
      },
    },
    battle: {
      async battle(input) {
        assert.deepEqual(input, {
          playerId: "9",
          interactionId: interaction.id,
        });
        return {
          match: { matchId: "12", winnerTeam: 1 },
          teams: [team(1, "Your Team", 95), team(2, "SlamDunk AI", 88)],
        };
      },
    },
  };

  await battleCommand.execute(interaction, { services });

  assert.equal(replies[0].type, "defer");
  const embed = replies[1].payload.embeds[0].toJSON();
  assert.equal(embed.title, "Victory!");
  assert.match(embed.description, /95/);
  assert.match(embed.fields[0].value, /PTS/);
});
