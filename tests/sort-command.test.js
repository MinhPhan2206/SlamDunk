import assert from "node:assert/strict";
import test from "node:test";

import { sortCommand } from "../src/bot/commands/sort.command.js";

function interactionFor(sortBy) {
  const replies = [];
  return {
    replies,
    user: { id: "234567890123456789", username: "SortTester" },
    options: { getString: () => sortBy },
    async deferReply(payload) { replies.push({ type: "defer", payload }); },
    async editReply(payload) { replies.push({ type: "edit", payload }); },
  };
}

test("sort command defaults to rarity when sort_by is omitted", async () => {
  const interaction = interactionFor(null);
  const services = {
    player: { async getOrCreatePlayer() { return { playerId: "7" }; } },
    collection: {
      async setSort(input) {
        assert.deepEqual(input, { playerId: "7", sortBy: "RARITY" });
        return { label: "Rarity" };
      },
    },
  };

  await sortCommand.execute(interaction, { services });

  assert.deepEqual(interaction.replies[0], {
    type: "defer",
    payload: { ephemeral: true },
  });
  assert.match(interaction.replies[1].payload, /Rarity/);
});
