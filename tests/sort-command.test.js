import assert from "node:assert/strict";
import test from "node:test";

import { sortCommand } from "../src/bot/commands/sort.command.js";
import { collectionSortDefinitions } from "../src/modules/collection/index.js";

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

test("Collection sort omits Overall and uses level-adjusted Card stats", () => {
  assert.equal(
    collectionSortDefinitions.some((definition) => definition.key === "OVERALL"),
    false,
  );
  const threePoint = collectionSortDefinitions.find(
    (definition) => definition.key === "THREE_POINT",
  );
  assert.match(threePoint.orderBy, /ct\.three_point - \(5 - ci\.card_level\)/);
});

test("every Collection sort uses player name as its secondary ordering", () => {
  for (const definition of collectionSortDefinitions) {
    assert.match(
      definition.orderBy,
      /(?:LOWER\(ct\.player_name\)|ct\.player_name) ASC/,
      `${definition.key} must use alphabetical secondary ordering.`,
    );
  }
});
