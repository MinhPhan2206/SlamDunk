import assert from "node:assert/strict";
import test from "node:test";

import { searchCardTemplates } from "../src/modules/card/card-search.js";

function template(playerName, cardTemplateId) {
  return Object.freeze({
    playerName,
    cardTemplateId,
    rarityRank: 4,
  });
}

const templates = Object.freeze([
  template("Nicolas Batum", "1"),
  template("Bam Adebayo", "2"),
  template("Mohamed Bamba", "3"),
  template("Jalen Brunson", "4"),
  template("Jaylen Brown", "5"),
  template("Jimmy Butler", "6"),
  template("Nikola Jokić", "7"),
]);

test("Card search supports initials, partial names, fuzzy names, and accents", () => {
  assert.deepEqual(
    searchCardTemplates(templates, "jb").map((card) => card.playerName),
    ["Jalen Brunson", "Jaylen Brown", "Jimmy Butler"],
  );
  assert.deepEqual(
    searchCardTemplates(templates, "bam").map((card) => card.playerName),
    ["Bam Adebayo", "Mohamed Bamba", "Nicolas Batum"],
  );
  assert.deepEqual(
    searchCardTemplates(templates, "jokic").map((card) => card.playerName),
    ["Nikola Jokić"],
  );
});
