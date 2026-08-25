import assert from "node:assert/strict";
import test from "node:test";

import { createSecurityEventAggregator } from "../src/modules/security/index.js";

function violation(overrides = {}) {
  return {
    eventType: "RATE_LIMITED",
    discordUserId: "user-1",
    guildId: "guild-1",
    channelId: "channel-1",
    commandName: "pack",
    metadata: { kind: "command", retryAfterMs: 900 },
    ...overrides,
  };
}

test("security event aggregator turns repeated denials into one write", async () => {
  const writes = [];
  const aggregator = createSecurityEventAggregator({
    writeEvents: async (events) => writes.push(events),
    now: () => 1_000,
  });

  for (let index = 0; index < 100; index += 1) {
    aggregator.record(violation());
  }
  assert.equal(writes.length, 0);
  assert.equal(await aggregator.flush(), 1);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].length, 1);
  assert.equal(writes[0][0].metadata.count, 100);
  assert.deepEqual(
    {
      persistedEvents: aggregator.snapshot().persistedEvents,
      persistedAggregates: aggregator.snapshot().persistedAggregates,
    },
    { persistedEvents: 100, persistedAggregates: 1 },
  );
});

test("security event aggregator bounds unique pending keys", () => {
  const aggregator = createSecurityEventAggregator({
    writeEvents: async () => {},
    maximumPendingKeys: 2,
  });

  assert.equal(aggregator.record(violation({ commandName: "pack" })), true);
  assert.equal(aggregator.record(violation({ commandName: "drop" })), true);
  assert.equal(aggregator.record(violation({ commandName: "battle" })), false);
  assert.equal(aggregator.record(violation({ commandName: "pack" })), true);
  assert.deepEqual(
    {
      pendingKeys: aggregator.snapshot().pendingKeys,
      pendingEvents: aggregator.snapshot().pendingEvents,
      droppedEvents: aggregator.snapshot().droppedEvents,
    },
    { pendingKeys: 2, pendingEvents: 3, droppedEvents: 1 },
  );
});

test("security event aggregator restores events after a failed write", async () => {
  let shouldFail = true;
  const aggregator = createSecurityEventAggregator({
    writeEvents: async () => {
      if (shouldFail) throw new Error("temporary failure");
    },
  });
  aggregator.record(violation());

  await assert.rejects(() => aggregator.flush(), /temporary failure/);
  assert.equal(aggregator.snapshot().pendingEvents, 1);
  assert.equal(aggregator.snapshot().flushFailures, 1);

  shouldFail = false;
  assert.equal(await aggregator.flush(), 1);
  assert.equal(aggregator.snapshot().pendingEvents, 0);
});
