import assert from "node:assert/strict";
import test from "node:test";

import { scheduleComponentTimeout } from "../src/bot/components/component-timeout.js";

test("interactive message components disable after inactivity", async () => {
  const edits = [];
  const message = {
    id: "timeout-test-message",
    components: [{
      type: 1,
      components: [{ type: 2, custom_id: "test:button", style: 1 }],
    }],
    async edit(payload) { edits.push(payload); },
  };
  await scheduleComponentTimeout(
    { async fetchReply() { return message; } },
    { timeoutMs: 5 },
  );
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(edits.length, 1);
  assert.equal(edits[0].components[0].components[0].disabled, true);
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
