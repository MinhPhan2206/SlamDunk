import assert from "node:assert/strict";
import test from "node:test";

import { oddsCommand } from "../src/bot/commands/odds.command.js";
import { gameConfig } from "../src/config/game-config.js";
import { buildRarityOdds } from "../src/modules/rarity/rarity-odds.js";
import { createPackService } from "../src/modules/pack/index.js";

function createInteraction(subcommand, packCode = null) {
  const replies = [];
  return {
    replies,
    interaction: {
      options: {
        getSubcommand() {
          return subcommand;
        },
        getString() {
          return packCode;
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

test("odds drop command shows the finalized rarity names", async () => {
  const { interaction, replies } = createInteraction("drop");
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
  assert.match(embed.description, /Base.*50\.0000%/);
  assert.match(embed.description, /Goat.*0\.0005%/);
});

test("odds pack command resolves a Pack by its scalable pack code", async () => {
  const { interaction, replies } = createInteraction("pack", "standard");
  const services = {
    pack: createPackService({ packCatalog: gameConfig.packs }),
  };

  await oddsCommand.execute(interaction, { services });

  const embed = replies[1].payload.embeds[0].toJSON();
  assert.equal(embed.title, "Standard Pack Odds");
  assert.match(embed.description, /Base.*10\.0000%/);
  assert.match(embed.description, /Goat.*0\.0100%/);
  assert.match(embed.footer.text, /standard/);
});
