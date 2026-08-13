import assert from "node:assert/strict";
import test from "node:test";

import { helpCommand } from "../src/bot/commands/help.command.js";
import { createHelpEmbeds } from "../src/bot/presenters/help.presenter.js";

test("help command exposes Strategy and Traits topics", () => {
  const data = helpCommand.data.toJSON();
  assert.equal(data.name, "help");
  assert.equal(data.options[0].required, true);
  assert.deepEqual(data.options[0].choices.map((choice) => choice.value), [
    "strategy",
    "traits",
  ]);
});

test("strategy help explains every configurable strategy group", async () => {
  const replies = [];
  await helpCommand.execute({
    options: { getString: () => "strategy" },
    async reply(payload) { replies.push(payload); },
  });
  const payload = replies[0];
  assert.equal(payload.embeds.length, 3);
  const content = payload.embeds.map((embed) => JSON.stringify(embed.toJSON())).join(" ");
  for (const text of ["Pace & Space", "Main Handler", "Defense", "Rebounding", "Player Tendencies"]) {
    assert.match(content, new RegExp(text.replace("&", "&")));
  }
});

test("traits help documents all 27 Battle Traits", () => {
  const embeds = createHelpEmbeds("traits");
  assert.equal(embeds.length, 2);
  assert.equal(embeds.reduce((total, embed) =>
    total + embed.toJSON().fields.length, 0), 27);
  const content = embeds.map((embed) => JSON.stringify(embed.toJSON())).join(" ");
  assert.match(content, /Mamba Instinct/);
  assert.match(content, /Cold-Blooded/);
});
