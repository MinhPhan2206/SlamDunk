import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { APPROVED_BATTLE_TRAIT_CODES } from "../src/modules/battle/battle-trait-resolver.js";

const traitCatalogUrl = new URL(
  "../data/card-template-traits.json",
  import.meta.url,
);

test("GOAT Trait profiles match the audited workbook totals", async () => {
  const profiles = JSON.parse(await readFile(traitCatalogUrl, "utf8"));
  const expectedTotals = new Map([
    ["LeBron James", 87],
    ["Stephen Curry", 82],
    ["Michael Jordan", 87],
    ["Kobe Bryant", 86],
    ["Kareem Abdul-Jabbar", 78],
  ]);
  const approvedCodes = new Set(APPROVED_BATTLE_TRAIT_CODES);

  assert.equal(profiles.length, expectedTotals.size);
  assert.equal(new Set(profiles.map((profile) => profile.playerName)).size, profiles.length);

  for (const profile of profiles) {
    assert.equal(profile.rarityCode, "GOAT");
    assert.equal(
      profile.traits.reduce((total, trait) => total + trait.traitTier, 0),
      expectedTotals.get(profile.playerName),
    );
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
