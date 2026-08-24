import assert from "node:assert/strict";
import test from "node:test";

import {
  battleCommand,
  practiceCommand,
} from "../src/bot/commands/battle.command.js";
import { gameConfig } from "../src/config/game-config.js";

test("Battle and Practice use their approved independent cooldowns", () => {
  assert.equal(gameConfig.battle.cooldownSeconds, 60 * 60);
  assert.equal(gameConfig.battle.practice.cooldownSeconds, 10);
});

test("battle command starts the runtime Battle playback", async () => {
  const replies = [];
  const interaction = {
    id: "123456789012345678",
    user: { id: "234567890123456789", username: "BattleTester" },
    options: {
      getString(name, required) {
        assert.equal(name, "opponent_bracket");
        assert.equal(required, true);
        return "pro";
      },
    },
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
          opponentBracket: "pro",
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

test("practice command starts reward-free Battle playback", async () => {
  const interaction = {
    id: "323456789012345678",
    user: { id: "434567890123456789", username: "PracticeTester" },
    options: {
      getString(name, required) {
        assert.equal(name, "opponent_bracket");
        assert.equal(required, true);
        return "street";
      },
    },
    async deferReply() {},
  };
  const result = {
    match: { publicMatchId: "0a038642a1404d938a3dc5b401f17c23" },
    reward: null,
  };
  const calls = [];
  await practiceCommand.execute(interaction, {
    services: {
      player: {
        async getOrCreatePlayer() { return { playerId: "19" }; },
      },
      battle: {
        async practice(input) {
          assert.deepEqual(input, {
            playerId: "19",
            interactionId: interaction.id,
            opponentBracket: "street",
          });
          return result;
        },
      },
    },
    battlePlayback: {
      async start(input) { calls.push(input); },
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].result.reward, null);
  assert.equal(calls[0].ownerDiscordUserId, interaction.user.id);
  assert.equal(practiceCommand.componentInactivityTimeoutMs, 60_000);
});

test("practice uses the Battle channel restriction inside the Community Server", async () => {
  const replies = [];
  let playerLookupCalled = false;
  const interaction = {
    guildId: "111111111111111111",
    channelId: "999999999999999999",
    user: { id: "434567890123456789", username: "PracticeTester" },
    async deferReply() {},
    async editReply(payload) { replies.push(payload); },
  };

  await practiceCommand.execute(interaction, {
    services: {
      player: {
        async getOrCreatePlayer() {
          playerLookupCalled = true;
        },
      },
    },
    battlePlayback: {},
    communityAccess: {
      guildId: "111111111111111111",
      battleChannelIds: ["311111111111111111"],
    },
  });

  assert.equal(playerLookupCalled, false);
  assert.equal(replies.length, 1);
  assert.match(replies[0].content, /Community Server channels/);
});
