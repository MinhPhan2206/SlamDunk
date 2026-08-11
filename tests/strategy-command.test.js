import assert from "node:assert/strict";
import test from "node:test";

import { MessageFlags } from "discord.js";

import { strategyCommand } from "../src/bot/commands/strategy.command.js";
import { createStrategyDraftStore } from "../src/bot/strategy/strategy-draft-store.js";
import { DEFAULT_LINEUP_STRATEGY } from "../src/modules/lineup/index.js";

test("/strategy opens an ephemeral editor from the saved Lineup strategy", async () => {
  const calls = [];
  const strategyDrafts = createStrategyDraftStore();
  const message = { id: "strategy-message", components: [] };
  const interaction = {
    user: { id: "234567890123456789", username: "Coach" },
    async deferReply(payload) { calls.push(["defer", payload]); },
    async editReply(payload) {
      calls.push(["edit", payload]);
      return message;
    },
  };

  try {
    await strategyCommand.execute(interaction, {
      strategyDrafts,
      services: {
        player: {
          async getOrCreatePlayer(input) {
            assert.deepEqual(input, {
              discordUserId: interaction.user.id,
              usernameSnapshot: interaction.user.username,
            });
            return { playerId: "7" };
          },
        },
        lineup: {
          async getStrategy(playerId) {
            assert.equal(playerId, "7");
            return {
              lineupId: "9",
              strategy: DEFAULT_LINEUP_STRATEGY,
              strategyRevision: 3,
              players: [{
                slot: "PG",
                cardInstanceId: "101",
                playerName: "Test Guard",
              }],
            };
          },
        },
      },
    });

    assert.deepEqual(calls[0], [
      "defer",
      { flags: MessageFlags.Ephemeral },
    ]);
    const payload = calls[1][1];
    assert.equal(payload.embeds[0].toJSON().title, "Team Strategy");
    assert.equal(payload.components.length, 2);
    const customId = payload.components[0].components[0].data.custom_id;
    assert.match(customId, /^strategy:handler:[0-9a-f]{32}$/);
    const sessionId = customId.split(":")[2];
    assert.match(
      payload.components[1].components[0].data.custom_id,
      /^strategy:customize:[0-9a-f]{32}$/,
    );
    assert.equal(strategyDrafts.get(sessionId).messageId, message.id);
    assert.equal(strategyCommand.componentInactivityTimeoutMs, 60_000);
    assert.deepEqual(strategyCommand.data.toJSON().options ?? [], []);
  } finally {
    strategyDrafts.stop();
  }
});
