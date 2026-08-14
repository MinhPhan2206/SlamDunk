import assert from "node:assert/strict";
import test from "node:test";

import { helpCommand } from "../src/bot/commands/help.command.js";
import { helpComponent } from "../src/bot/components/help.component.js";
import {
  createHelpTopicPayload,
  createManualHelpPayload,
} from "../src/bot/presenters/help.presenter.js";

test("help command exposes Manual, Strategy, and Traits topics", () => {
  const data = helpCommand.data.toJSON();
  assert.equal(data.name, "help");
  assert.equal(data.options[0].required, true);
  assert.deepEqual(data.options[0].choices.map((choice) => choice.value), [
    "manual",
    "strategy",
    "traits",
  ]);
});

test("manual help renders one embed with four owner-bound tabs", async () => {
  const replies = [];
  await helpCommand.execute({
    user: { id: "234567890123456789" },
    options: { getString: () => "manual" },
    async reply(payload) { replies.push(payload); },
  });
  const payload = replies[0];
  assert.equal(payload.embeds.length, 1);
  assert.equal(payload.components[0].components.length, 4);
  assert.equal(
    payload.components[0].components[0].data.custom_id,
    "help:manual:234567890123456789:start",
  );
  assert.equal(payload.components[0].components[0].data.disabled, true);
});

test("manual tabs cover every new Player command group", () => {
  const content = ["start", "cards", "progress", "compete"]
    .map((selectedTab) => createManualHelpPayload({
      viewerDiscordUserId: "234567890123456789",
      selectedTab,
    }))
    .map((payload) => JSON.stringify(payload.embeds[0].toJSON()))
    .join(" ");
  for (const text of [
    "Quick Start",
    "/claim",
    "/drop",
    "/collection",
    "/lineup set",
    "/strategy",
    "/battle",
    "/pack",
    "/quicksell",
    "/market",
    "/trade",
    "Final Accept",
  ]) {
    assert.match(content, new RegExp(text.replace("/", "\\/")));
  }
});

test("manual tabs keep one consistent embed color", () => {
  const colors = ["start", "cards", "progress", "compete"].map((selectedTab) =>
    createManualHelpPayload({
      viewerDiscordUserId: "234567890123456789",
      selectedTab,
    }).embeds[0].toJSON().color);
  assert.equal(new Set(colors).size, 1);
});

test("manual tab component edits the same message for its owner", async () => {
  let updated;
  await helpComponent.execute({
    customId: "help:manual:234567890123456789:cards",
    user: { id: "234567890123456789" },
    async update(payload) { updated = payload; },
  });

  assert.equal(updated.embeds.length, 1);
  assert.match(updated.embeds[0].toJSON().title, /Cards & Lineup/);
  assert.equal(updated.components[0].components[1].data.disabled, true);
});

test("manual tabs are owner-only", async () => {
  let reply;
  await helpComponent.execute({
    customId: "help:manual:234567890123456789:compete",
    user: { id: "345678901234567890" },
    async reply(payload) { reply = payload; },
  });

  assert.match(reply.content, /Only the user/);
  assert.ok(reply.flags);
});

test("strategy help explains every configurable strategy group", async () => {
  const replies = [];
  await helpCommand.execute({
    user: { id: "234567890123456789" },
    options: { getString: () => "strategy" },
    async reply(payload) { replies.push(payload); },
  });
  const payload = replies[0];
  assert.equal(payload.embeds.length, 1);
  assert.equal(payload.components[0].components.length, 3);
  const tabs = ["offense", "team", "tendencies"].map((selectedTab) =>
    createHelpTopicPayload({
      topic: "strategy",
      viewerDiscordUserId: "234567890123456789",
      selectedTab,
    }));
  const content = tabs.map((tab) => JSON.stringify(tab.embeds[0].toJSON())).join(" ");
  for (const text of ["Pace & Space", "Main Handler", "Defense", "Rebounding", "Player Tendencies"]) {
    assert.match(content, new RegExp(text.replace("&", "&")));
  }
  assert.equal(new Set(tabs.map((tab) => tab.embeds[0].toJSON().color)).size, 1);
});

test("traits help documents all 27 Battle Traits in consistent tabs", async () => {
  const tabs = ["scoring", "creation", "defense", "physical", "clutch"].map((selectedTab) =>
    createHelpTopicPayload({
      topic: "traits",
      viewerDiscordUserId: "234567890123456789",
      selectedTab,
    }));
  assert.equal(tabs.reduce((total, tab) =>
    total + tab.embeds[0].toJSON().fields.length, 0), 27);
  assert.equal(new Set(tabs.map((tab) => tab.embeds[0].toJSON().color)).size, 1);
  assert.equal(tabs[0].components[0].components.length, 5);
  const content = tabs.map((tab) => JSON.stringify(tab.embeds[0].toJSON())).join(" ");
  assert.match(content, /Mamba Instinct/);
  assert.match(content, /Cold-Blooded/);

  let updated;
  await helpComponent.execute({
    customId: "help:traits:234567890123456789:defense",
    user: { id: "234567890123456789" },
    async update(payload) { updated = payload; },
  });
  assert.match(updated.embeds[0].toJSON().title, /Defense/);
  assert.equal(updated.components[0].components[2].data.disabled, true);
});
