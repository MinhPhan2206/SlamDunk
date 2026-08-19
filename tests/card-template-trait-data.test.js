import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { APPROVED_BATTLE_TRAIT_CODES } from "../src/modules/battle/battle-trait-resolver.js";

const templateCatalogUrl = new URL("../data/card-templates.json", import.meta.url);
const traitCatalogUrl = new URL(
  "../data/card-template-traits.json",
  import.meta.url,
);

const EXPECTED_RARITY_COUNTS = Object.freeze({
  GOAT: 5,
  SUPERSTAR: 10,
  ALL_STAR: 18,
  ALPHA: 36,
  UNCOMMON: 44,
  COMMON: 76,
  BASE: 86,
});

function catalogKey(entry) {
  return `${entry.rarityCode}:${entry.playerName.toLowerCase()}`;
}

test("official Card and Trait catalogs stay aligned", async () => {
  const [templates, profiles] = await Promise.all([
    readFile(templateCatalogUrl, "utf8").then(JSON.parse),
    readFile(traitCatalogUrl, "utf8").then(JSON.parse),
  ]);
  const approvedCodes = new Set(APPROVED_BATTLE_TRAIT_CODES);
  const templateKeys = new Set(templates.map(catalogKey));
  const profileKeys = new Set(profiles.map(catalogKey));

  assert.equal(templates.length, 275);
  assert.equal(profiles.length, templates.length);
  assert.equal(templateKeys.size, templates.length);
  assert.deepEqual(profileKeys, templateKeys);
  assert.ok(!templates.some(({ playerName }) =>
    [
      "Dalano Banton",
      "Dariq Whitehead",
      "Trey Lyles",
      "Malaki Branham",
    ].includes(playerName)
  ));

  const rarityCounts = Object.fromEntries(
    Object.keys(EXPECTED_RARITY_COUNTS).map((rarityCode) => [
      rarityCode,
      templates.filter((template) => template.rarityCode === rarityCode).length,
    ]),
  );
  assert.deepEqual(rarityCounts, EXPECTED_RARITY_COUNTS);

  for (const profile of profiles) {
    assert.equal(
      new Set(profile.traits.map((trait) => trait.traitCode)).size,
      profile.traits.length,
    );
    assert.ok(profile.traits.every((trait) =>
      approvedCodes.has(trait.traitCode) &&
      Number.isInteger(trait.traitTier) &&
      trait.traitTier >= 1 &&
      trait.traitTier <= 5
    ));
  }
});
