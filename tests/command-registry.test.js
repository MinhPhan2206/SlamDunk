import assert from "node:assert/strict";
import test from "node:test";

import { commands } from "../src/bot/commands/index.js";

test("Slash command registry has valid unique command definitions", () => {
  const payload = commands.map((command) => command.data.toJSON());
  const names = payload.map((command) => command.name);

  assert.equal(new Set(names).size, names.length);
  for (const expected of [
    "market", "sell", "unlist", "buy", "upgrade", "level-up", "card",
    "wallet", "bag", "strategy", "welcome", "practice", "compare",
    "level-rewards",
    "contract",
  ]) {
    assert.ok(names.includes(expected));
  }
  assert.equal(payload.find((command) => command.name === "market").options[0].name, "page");
  assert.equal(payload.find((command) => command.name === "upgrade").options.length, 0);
});
