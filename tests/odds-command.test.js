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

test("approved Drop and Standard Pack economy configuration is exact", () => {
  const dropOdds = new Map(
    buildRarityOdds(gameConfig.drop.rarityWeights)
      .map((entry) => [entry.rarityCode, entry.probabilityPercent]),
  );
  const standard = gameConfig.packs.find((pack) => pack.packCode === "standard");
  const standardOdds = new Map(
    buildRarityOdds(standard.rarityWeights)
      .map((entry) => [entry.rarityCode, entry.probabilityPercent]),
  );

  assert.equal(standard.priceCurrency, "GOLD");
  assert.equal(standard.priceAmount, 5_000);
  assert.equal(standard.cardCount, 3);
  assert.ok(Math.abs(dropOdds.get("ALPHA") - 0.075132) < 1e-9);
  assert.ok(Math.abs(dropOdds.get("GOAT") - 0.0000833) < 1e-9);
  assert.ok(Math.abs(standardOdds.get("ALPHA") - 3.451062) < 1e-9);
  assert.ok(Math.abs(standardOdds.get("ALL_STAR") - 0.671161) < 1e-9);
  assert.ok(Math.abs(standardOdds.get("SUPERSTAR") - 0.008334) < 1e-9);
  assert.ok(Math.abs(standardOdds.get("GOAT") - 0.001667) < 1e-9);
});

test("Super Pack costs Shards and only rolls Alpha or higher", () => {
  const superPack = gameConfig.packs.find((pack) => pack.packCode === "super");
  const odds = new Map(
    buildRarityOdds(superPack.rarityWeights)
      .map((entry) => [entry.rarityCode, entry.probabilityPercent]),
  );

  assert.equal(superPack.priceCurrency, "SHARDS");
  assert.equal(superPack.priceAmount, 2_000);
  assert.equal(superPack.cardCount, 1);
  assert.equal(odds.get("BASE"), 0);
  assert.ok(Math.abs(odds.get("ALPHA") - 75) < 1e-9);
  assert.ok(Math.abs(odds.get("ALL_STAR") - 24.153846) < 1e-9);
  assert.ok(Math.abs(odds.get("SUPERSTAR") - 0.769231) < 1e-9);
  assert.ok(Math.abs(odds.get("GOAT") - 0.076923) < 1e-9);
});

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
  assert.match(embed.description, /Base.*52\.4953%/);
  assert.match(embed.description, /Goat.*0\.00008%/);
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
  assert.match(embed.description, /Base.*13\.8773%/);
  assert.match(embed.description, /Goat.*0\.0017%/);
  assert.equal(embed.footer, undefined);
});

test("odds pack_type exposes Super Pack odds", async () => {
  const { interaction, replies } = createInteraction("super");
  const services = {
    pack: createPackService({ packCatalog: gameConfig.packs }),
  };

  await oddsCommand.execute(interaction, { services });

  const embed = replies[1].payload.embeds[0].toJSON();
  assert.equal(embed.title, "Super Pack Odds");
  assert.match(embed.description, /Base\s+0\.00000%/);
  assert.match(embed.description, /Alpha\s+75\.0000%/);
  assert.match(embed.description, /Goat\s+0\.0769%/);
});
