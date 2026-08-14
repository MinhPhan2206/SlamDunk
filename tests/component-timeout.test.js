import assert from "node:assert/strict";
import test from "node:test";

import {
  COMPONENT_INACTIVITY_TIMEOUT_MS,
  scheduleComponentTimeout,
} from "../src/bot/components/component-timeout.js";

test("default component inactivity timeout is 20 seconds", () => {
  assert.equal(COMPONENT_INACTIVITY_TIMEOUT_MS, 20_000);
});

test("interactive message components disable after inactivity", async () => {
  const edits = [];
  const message = {
    id: "timeout-test-message",
    components: [{
      type: 1,
      components: [{ type: 2, custom_id: "test:button", style: 1 }],
    }],
    embeds: [{ toJSON() { return { title: "Menu" }; } }],
    async edit(payload) { edits.push(payload); },
  };
  await scheduleComponentTimeout(
    { async fetchReply() { return message; } },
    { timeoutMs: 5 },
  );
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(edits.length, 1);
  assert.equal(edits[0].components[0].components[0].disabled, true);
  assert.equal(edits[0].embeds[0].footer.text, "Interaction Expired");
});

test("new component interaction resets the inactivity timeout", async () => {
  const edits = [];
  const message = {
    id: "timeout-reset-message",
    components: [{
      type: 1,
      components: [{ type: 2, custom_id: "test:button", style: 1 }],
    }],
    async edit(payload) { edits.push(payload); },
  };
  const interaction = { async fetchReply() { return message; } };
  await scheduleComponentTimeout(interaction, { timeoutMs: 100 });
  await new Promise((resolve) => setTimeout(resolve, 20));
  await scheduleComponentTimeout(interaction, { timeoutMs: 100 });
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(edits.length, 0);
  await new Promise((resolve) => setTimeout(resolve, 70));
  assert.equal(edits.length, 1);
});

test("timeout does not resend attachment-backed embeds", async () => {
  const edits = [];
  const attachment = {
    id: "42",
    name: "card.png",
    url: "https://cdn.discordapp.com/attachments/channel/message/card.png",
  };
  const message = {
    id: "timeout-attachment-message",
    components: [{
      type: 1,
      components: [{ type: 2, custom_id: "card:button", style: 1 }],
    }],
    attachments: new Map([[attachment.id, attachment]]),
    embeds: [{
      toJSON() {
        return {
          title: "Nikola Jokic",
          thumbnail: { url: attachment.url },
        };
      },
    }],
    async edit(payload) { edits.push(payload); },
  };
  await scheduleComponentTimeout(
    { async fetchReply() { return message; } },
    { timeoutMs: 5 },
  );
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(edits.length, 1);
  assert.equal(edits[0].embeds, undefined);
  assert.equal(edits[0].attachments, undefined);
  assert.equal(edits[0].components[0].components[0].disabled, true);
});

test("preserveEmbeds disables components without relying on attachment metadata", async () => {
  const edits = [];
  const message = {
    id: "timeout-preserve-embed-message",
    components: [{
      type: 1,
      components: [{ type: 2, custom_id: "card:button", style: 1 }],
    }],
    embeds: [{ toJSON() { return { title: "Card" }; } }],
    async edit(payload) { edits.push(payload); },
  };
  await scheduleComponentTimeout(
    { async fetchReply() { return message; } },
    { timeoutMs: 5, preserveEmbeds: true },
  );
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(edits.length, 1);
  assert.deepEqual(Object.keys(edits[0]), ["components"]);
  assert.equal(edits[0].components[0].components[0].disabled, true);
});

test("ephemeral timeout edits through the interaction webhook without fetching the message", async () => {
  const edits = [];
  let fetchCount = 0;
  const message = {
    id: "ephemeral-timeout-message",
    components: [{
      type: 1,
      components: [{ type: 2, custom_id: "strategy:save:test", style: 3 }],
    }],
    embeds: [{ toJSON() { return { title: "Team Strategy" }; } }],
    async fetch() {
      fetchCount += 1;
      throw Object.assign(new Error("Unknown Message"), { code: 10_008 });
    },
  };
  const interaction = {
    async fetchReply() { return message; },
    async editReply(payload) { edits.push(payload); },
  };

  await scheduleComponentTimeout(interaction, { timeoutMs: 5 });
  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.equal(fetchCount, 0);
  assert.equal(edits.length, 1);
  assert.equal(edits[0].components[0].components[0].disabled, true);
});
