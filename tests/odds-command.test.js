import assert from "node:assert/strict";
import test from "node:test";

import { oddsCommand } from "../src/bot/commands/odds.command.js";
import { gameConfig } from "../src/config/game-config.js";
import { buildRarityOdds } from "../src/modules/rarity/rarity-odds.js";
import { createPackService } from "../src/modules/pack/index.js";

function createInteraction(packType = null) {
  const replies = [];
  return {
    replies,
    interaction: {
      options: {
        getString(name) {
          assert.equal(name, "pack_type");
          return packType;
        },
      },
      async deferReply() {
        replies.push({ type: "defer" });
      },
      async editReply(payload) {
        replies.push({ type: "edit", payload });
      },
    },
  };
}

test("odds defaults to Free Drop and shows the finalized rarity names", async () => {
  const { interaction, replies } = createInteraction();
  const services = {
    drop: {
      getOdds() {
        return {
          source: "drop",
          displayName: "Free Drop",
          candidateCount: 3,
          odds: buildRarityOdds(gameConfig.drop.rarityWeights),
        };
      },
    },
  };

  await oddsCommand.execute(interaction, { services });

  const embed = replies[1].payload.embeds[0].toJSON();
  assert.match(embed.description, /Base.*52\.4499%/);
  assert.match(embed.description, /Goat.*0\.00007%/);
  assert.equal(embed.footer, undefined);
});

test("odds pack_type resolves a Pack by its scalable pack code", async () => {
  const { interaction, replies } = createInteraction("standard");
  const services = {
    pack: createPackService({ packCatalog: gameConfig.packs }),
  };

  await oddsCommand.execute(interaction, { services });

  const embed = replies[1].payload.embeds[0].toJSON();
  assert.equal(embed.title, "Standard Pack Odds");
  assert.match(embed.description, /Base.*13\.9503%/);
  assert.match(embed.description, /Goat.*0\.0017%/);
  assert.equal(embed.footer, undefined);
});
