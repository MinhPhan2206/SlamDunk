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

