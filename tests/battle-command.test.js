import assert from "node:assert/strict";
import test from "node:test";

import { battleCommand } from "../src/bot/commands/battle.command.js";

test("battle command displays the Battle v2 score, box score, and recent plays", async () => {
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
      points: index === 0 ? finalScore - 8 : 2,
      rebounds: index,
      assists: index,
      steals: 0,
      blocks: 0,
      turnovers: 1,
      fieldGoalsMade: 2,
      fieldGoalsAttempted: 4,
      threePointersMade: 1,
      threePointersAttempted: 2,
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
          match: {
            matchId: "12",
            winnerTeam: 1,
            engineVersion: "2.0.0",
            possessionCount: 18,
            playByPlay: [{ possession: 18, description: "Player PG makes the three." }],
          },
          teams: [team(1, "Your Team", 21), team(2, "SlamDunk AI", 18)],
        };
      },
    },
  };

  await battleCommand.execute(interaction, { services });

  assert.equal(replies[0].type, "defer");
  const embed = replies[1].payload.embeds[0].toJSON();
  assert.equal(embed.title, "Victory!");
  assert.match(embed.description, /21/);
  assert.match(embed.fields[0].value, /FG 2\/4/);
  assert.match(embed.fields[2].value, /makes the three/);
  assert.match(embed.footer.text, /Engine 2\.0\.0/);
});
