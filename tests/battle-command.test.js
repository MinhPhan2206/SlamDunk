import assert from "node:assert/strict";
import test from "node:test";

import { battleCommand } from "../src/bot/commands/battle.command.js";

test("battle command starts the runtime Battle playback", async () => {
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
  const playbackCalls = [];
  const battlePlayback = {
    async start(input) {
      playbackCalls.push(input);
    },
  };

  await battleCommand.execute(interaction, { services, battlePlayback });

  assert.equal(replies[0].type, "defer");
  assert.equal(playbackCalls.length, 1);
  assert.equal(playbackCalls[0].interaction, interaction);
  assert.equal(playbackCalls[0].ownerDiscordUserId, interaction.user.id);
  assert.equal(playbackCalls[0].ownerDisplayName, interaction.user.username);
  assert.equal(playbackCalls[0].result.match.matchId, "12");
  assert.equal(battleCommand.componentInactivityTimeoutMs, 60_000);
});
