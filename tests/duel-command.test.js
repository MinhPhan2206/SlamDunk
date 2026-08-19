import assert from "node:assert/strict";
import test from "node:test";

import { duelCommand } from "../src/bot/commands/duel.command.js";
import { duelComponent } from "../src/bot/components/duel.component.js";

const DUEL_ID = "1a038642a1404d938a3dc5b401f17c23";
const MATCH_ID = "2a038642a1404d938a3dc5b401f17c23";

function duelResult() {
  return {
    challenge: {
      publicDuelId: DUEL_ID,
      expiresAt: new Date(Date.now() + 60_000),
    },
    challenger: {
      playerId: "1",
      discordUserId: "111111111111111111",
      usernameSnapshot: "Challenger",
    },
    challenged: {
      playerId: "2",
      discordUserId: "222222222222222222",
      usernameSnapshot: "Opponent",
    },
  };
}

function lineup(prefix) {
  return {
    complete: true,
    slots: ["PG", "SG", "SF", "PF", "C"].map((slot) => ({
      slot,
      cardInstanceId: `${slot.length + 1}`,
      playerName: `${prefix} ${slot}`,
      rarityCode: "COMMON",
      cardLevel: 5,
    })),
  };
}

test("duel command creates a 60-second friendly invitation", async () => {
  const edits = [];
  const interaction = {
    id: "333333333333333333",
    user: {
      id: "111111111111111111",
      username: "Challenger",
    },
    options: {
      getUser(name, required) {
        assert.equal(name, "user");
        assert.equal(required, true);
        return {
          id: "222222222222222222",
          username: "Opponent",
          bot: false,
        };
      },
    },
    async deferReply() {},
    async editReply(payload) { edits.push(payload); },
  };
  const players = new Map([
    ["111111111111111111", duelResult().challenger],
    ["222222222222222222", duelResult().challenged],
  ]);
  await duelCommand.execute(interaction, {
    services: {
      player: {
        async getOrCreatePlayer(input) {
          return players.get(input.discordUserId);
        },
      },
      lineup: {
        async getLineup(playerId) {
          return playerId === "1" ? lineup("Challenger") : lineup("Opponent");
        },
      },
      battle: {
        async createDuelChallenge(input) {
          assert.deepEqual(input, {
            challengerPlayerId: "1",
            challengedPlayerId: "2",
            interactionId: interaction.id,
          });
          return duelResult();
        },
      },
    },
  });

  assert.equal(duelCommand.componentInactivityTimeoutMs, 60_000);
  assert.equal(edits[0].embeds[0].toJSON().title, "DUEL INVITATION");
  assert.equal(
    edits[0].content,
    "<@222222222222222222>, **Challenger** challenged you to a Duel!",
  );
  assert.deepEqual(edits[0].allowedMentions, {
    users: ["222222222222222222"],
  });
  assert.equal(edits[0].embeds[0].toJSON().fields.length, 2);
  assert.match(edits[0].embeds[0].toJSON().fields[0].value, /Challenger PG · Common · Lv\.5/);
  assert.doesNotMatch(edits[0].embeds[0].toJSON().description, /active Lineup|expires/i);
  assert.equal(edits[0].components[0].components[0].data.custom_id, `duel:accept:${DUEL_ID}`);
  assert.equal(edits[0].components[0].components[1].data.custom_id, `duel:decline:${DUEL_ID}`);
});

test("accepting a Duel starts shared playback for both participants", async () => {
  const started = [];
  const duel = {
    ...duelResult(),
    result: { match: { publicMatchId: MATCH_ID } },
  };
  const interaction = {
    customId: `duel:accept:${DUEL_ID}`,
    user: { id: "222222222222222222", username: "Opponent" },
    async deferUpdate() {},
  };
  await duelComponent.execute(interaction, {
    services: {
      player: {
        async getOrCreatePlayer() { return duel.challenged; },
      },
      battle: {
        async acceptDuelChallenge(input) {
          assert.deepEqual(input, { publicDuelId: DUEL_ID, playerId: "2" });
          return duel;
        },
      },
    },
    battlePlayback: {
      async start(input) { started.push(input); },
    },
  });

  assert.equal(started.length, 1);
  assert.equal(started[0].componentNamespace, "duel");
  assert.deepEqual(started[0].simulateVoterDiscordUserIds, [
    "111111111111111111",
    "222222222222222222",
  ]);
  assert.equal(started[0].opponentDisplayName, "Opponent");
});
