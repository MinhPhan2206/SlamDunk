import assert from "node:assert/strict";
import test from "node:test";

import {
  AbuseGuardError,
  createAbuseGuard,
} from "../src/modules/security/index.js";

test("abuse guard rate-limits command bursts without limiting Pack quantity", () => {
  let timestamp = 1_000;
  const guard = createAbuseGuard({
    now: () => timestamp,
    policies: {
      command: { limit: 2, windowMs: 1_000 },
      prefix: { limit: 2, windowMs: 1_000 },
      component: { limit: 2, windowMs: 1_000 },
      autocomplete: { limit: 2, windowMs: 1_000 },
    },
  });
  guard.acquire({ userId: "1", guildId: "2", commandName: "profile" }).release();
  guard.acquire({ userId: "1", guildId: "2", commandName: "profile" }).release();
  assert.throws(
    () => guard.acquire({ userId: "1", guildId: "2", commandName: "profile" }),
    (error) => error instanceof AbuseGuardError && error.code === "RATE_LIMITED",
  );
  timestamp += 1_001;
  assert.doesNotThrow(() =>
    guard.acquire({
      userId: "1",
      guildId: "2",
      commandName: "pack",
      quantity: 100,
    }).release()
  );
});

test("abuse guard serializes economy operations and caps heavy work", () => {
  const guard = createAbuseGuard({ maximumHeavyOperations: 1 });
  const pack = guard.acquire({
    userId: "1",
    guildId: "2",
    commandName: "pack",
  });
  assert.throws(
    () => guard.acquire({ userId: "1", guildId: "2", commandName: "pack" }),
    (error) => error.code === "OPERATION_IN_PROGRESS",
  );
  assert.throws(
    () => guard.acquire({ userId: "2", guildId: "2", commandName: "battle" }),
    (error) => error.code === "BOT_BUSY",
  );
  pack.release();
  assert.doesNotThrow(() =>
    guard.acquire({ userId: "2", guildId: "2", commandName: "battle" }).release()
  );
});

test("abuse guard removes expired rate windows", () => {
  let timestamp = 1_000;
  const guard = createAbuseGuard({
    now: () => timestamp,
    policies: { command: { limit: 10, windowMs: 1_000 } },
  });

  for (let index = 0; index < 20; index += 1) {
    guard.acquire({
      userId: String(index),
      guildId: "guild",
      commandName: "profile",
    }).release();
  }
  assert.equal(guard.snapshot().trackedRateWindows, 20);

  timestamp += 1_001;
  assert.equal(guard.cleanup(), 0);
  assert.equal(guard.snapshot().cleanupRuns, 1);
});

test("abuse guard bounds tracked rate windows", () => {
  const guard = createAbuseGuard({
    maximumTrackedWindows: 3,
    policies: { command: { limit: 10, windowMs: 60_000 } },
  });

  for (let index = 0; index < 5; index += 1) {
    guard.acquire({
      userId: String(index),
      guildId: "guild",
      commandName: "profile",
    }).release();
  }

  assert.equal(guard.snapshot().trackedRateWindows, 3);
  assert.equal(guard.snapshot().capacityEvictions, 2);
});

test("abuse guard starts and cancels its cleanup timer", () => {
  let scheduled = null;
  let cancelled = null;
  const timer = { unref() {} };
  const guard = createAbuseGuard({
    scheduleRecurring(callback, interval) {
      scheduled = { callback, interval };
      return timer;
    },
    cancelRecurring(value) {
      cancelled = value;
    },
  });

  guard.start();
  assert.equal(scheduled.interval, 60_000);
  scheduled.callback();
  assert.equal(guard.snapshot().cleanupRuns, 1);
  guard.stop();
  assert.equal(cancelled, timer);
});
