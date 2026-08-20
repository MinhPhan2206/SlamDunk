import assert from "node:assert/strict";
import test from "node:test";

import { createStrategyDraftStore } from "../src/bot/strategy/strategy-draft-store.js";
import { DEFAULT_LINEUP_STRATEGY } from "../src/modules/lineup/index.js";

test("Strategy draft expiry discards the session and disables its controls", async () => {
  const scheduled = [];
  const cancelled = [];
  const edits = [];
  let currentTime = 0;
  const store = createStrategyDraftStore({
    timeoutMs: 60,
    now: () => currentTime,
    schedule(callback) {
      const timer = { callback, unref() {} };
      scheduled.push(timer);
      return timer;
    },
    cancel(timer) { cancelled.push(timer); },
  });
  const session = store.create({
    ownerDiscordUserId: "234567890123456789",
    playerId: "7",
    lineupId: "9",
    strategy: DEFAULT_LINEUP_STRATEGY,
    strategyRevision: 1,
    players: [{ slot: "PG", cardInstanceId: "101", playerName: "Guard" }],
  });
  const message = {
    id: "message-1",
    components: [{
      type: 1,
      components: [{ type: 2, custom_id: "strategy:save:test", style: 3 }],
    }],
    embeds: [{ toJSON() { return { title: "Team Strategy" }; } }],
    async fetch() { throw Object.assign(new Error("Unknown Message"), { code: 10_008 }); },
  };
  store.bindMessage(
    session.sessionId,
    message,
    async (payload) => { edits.push(payload); },
  );

  currentTime = 20;
  store.touch(session.sessionId);
  assert.equal(cancelled.length, 1);
  assert.equal(scheduled.length, 2);

  currentTime = 80;
  scheduled[1].callback();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(store.get(session.sessionId), null);
  assert.equal(edits.length, 1);
  assert.equal(edits[0].components[0].components[0].disabled, true);
  assert.equal(edits[0].embeds[0].footer.text, "Interaction Expired");
  store.stop();
});

test("Strategy players use basketball position order", () => {
  const store = createStrategyDraftStore();
  const session = store.create({
    ownerDiscordUserId: "234567890123456789",
    playerId: "7",
    lineupId: "9",
    strategy: DEFAULT_LINEUP_STRATEGY,
    strategyRevision: 1,
    players: [
      { slot: "SF", cardInstanceId: "103", playerName: "Forward" },
      { slot: "C", cardInstanceId: "105", playerName: "Center" },
      { slot: "PG", cardInstanceId: "101", playerName: "Guard" },
      { slot: "PF", cardInstanceId: "104", playerName: "Power" },
      { slot: "SG", cardInstanceId: "102", playerName: "Shooting" },
    ],
  });

  assert.deepEqual(session.players.map((player) => player.slot), [
    "PG", "SG", "SF", "PF", "C",
  ]);
  assert.equal(session.selectedTendencyCardId, "101");
  store.stop();
});
