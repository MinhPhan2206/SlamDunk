import assert from "node:assert/strict";
import test from "node:test";

import { voteCommand } from "../src/bot/commands/vote.command.js";

test("vote command verifies and presents a claimed Top.gg reward", async () => {
  const edits = [];
  const interaction = {
    user: { id: "111111111111111111", username: "Voter" },
    async deferReply() {},
    async editReply(payload) { edits.push(payload); },
  };
  await voteCommand.execute(interaction, {
    services: {
      player: {
        async getOrCreatePlayer() { return { playerId: "7" }; },
      },
      vote: {
        async claimVote(input) {
          assert.deepEqual(input, {
            playerId: "7",
            discordUserId: interaction.user.id,
          });
          return {
            voted: true,
            replayed: false,
            voteUrl: "https://top.gg/bot/222222222222222222/vote",
            rewardGold: "1000",
            rewardShards: "25",
            expiresAt: new Date(Date.now() + 60_000),
          };
        },
      },
    },
  });
  assert.equal(edits[0].embeds[0].toJSON().title, "VOTE FOR SLAMDUNK");
  assert.match(edits[0].embeds[0].toJSON().description, /Thanks/);
  assert.equal(edits[0].components[0].components[0].data.style, 5);
});
