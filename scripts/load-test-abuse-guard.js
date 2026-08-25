import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";

import {
  AbuseGuardError,
  createAbuseGuard,
  createSecurityEventAggregator,
} from "../src/modules/security/index.js";

const writes = [];
const aggregator = createSecurityEventAggregator({
  writeEvents: async (events) => writes.push(...events),
});
const guard = createAbuseGuard({
  maximumTrackedWindows: 50_000,
  onViolation: (event) => aggregator.record({
    eventType: event.eventType,
    discordUserId: event.userId,
    guildId: event.guildId,
    channelId: event.channelId,
    commandName: event.commandName,
    metadata: { kind: event.kind, retryAfterMs: event.retryAfterMs },
  }),
});

function runBurst({ attempts, kind = "command", commandName, userId }) {
  let accepted = 0;
  let denied = 0;
  const startedAt = performance.now();
  for (let index = 0; index < attempts; index += 1) {
    try {
      guard.acquire({
        userId: userId(index),
        guildId: "load-test-guild",
        channelId: "load-test-channel",
        commandName,
        kind,
        quantity: commandName === "pack" ? 100 : undefined,
      }).release();
      accepted += 1;
    } catch (error) {
      if (!(error instanceof AbuseGuardError)) throw error;
      denied += 1;
    }
  }
  return {
    attempts,
    accepted,
    denied,
    durationMilliseconds: Math.round(performance.now() - startedAt),
  };
}

const commandBurst = runBurst({
  attempts: 10_000,
  commandName: "profile",
  userId: () => "burst-user",
});
guard.stop();
const autocompleteBurst = runBurst({
  attempts: 10_000,
  kind: "autocomplete",
  commandName: "card",
  userId: () => "autocomplete-user",
});
guard.stop();
const packBatchBurst = runBurst({
  attempts: 1_000,
  commandName: "pack",
  userId: (index) => `pack-user-${index}`,
});

assert.ok(commandBurst.denied > 0);
assert.ok(autocompleteBurst.denied > 0);
assert.ok(packBatchBurst.denied > 0);
assert.ok(guard.snapshot().trackedRateWindows <= 50_000);
await aggregator.flush();
assert.ok(writes.length <= 500);

console.log(JSON.stringify({
  event: "SLAMDUNK_ABUSE_LOAD_TEST",
  commandBurst,
  autocompleteBurst,
  packBatchBurst,
  abuseGuard: guard.snapshot(),
  securityEvents: aggregator.snapshot(),
}));
