const DEFAULT_POLICIES = Object.freeze({
  autocomplete: Object.freeze({ limit: 5, windowMs: 5_000 }),
  component: Object.freeze({ limit: 10, windowMs: 10_000 }),
  prefix: Object.freeze({ limit: 5, windowMs: 10_000 }),
  command: Object.freeze({ limit: 10, windowMs: 10_000 }),
  guild: Object.freeze({ limit: 120, windowMs: 60_000 }),
  global: Object.freeze({ limit: 600, windowMs: 60_000 }),
});

const SINGLE_FLIGHT_COMMANDS = new Set([
  "battle", "buy", "claim", "contract", "daily", "drop", "duel",
  "exchange", "level-rewards", "level-up", "pack", "practice",
  "quicksell", "sell", "trade", "unlist", "upgrade", "weekly",
  "market-sell",
]);

const HEAVY_COMMANDS = new Set([
  "battle", "card", "compare", "contract", "drop", "duel", "lineup", "pack",
  "practice",
]);

export class AbuseGuardError extends Error {
  constructor(code, message, { retryAfterMs = 0 } = {}) {
    super(message);
    this.name = "AbuseGuardError";
    this.code = code;
    this.retryAfterMs = retryAfterMs;
  }
}

function identity(input) {
  return {
    userId: String(input.userId ?? "unknown"),
    guildId: String(input.guildId ?? "dm"),
    channelId: String(input.channelId ?? "unknown"),
    commandName: String(input.commandName ?? "unknown").toLowerCase(),
    kind: String(input.kind ?? "command").toLowerCase(),
  };
}

function userMessage(error) {
  if (error.code === "OPERATION_IN_PROGRESS") {
    return "Your previous operation is still being processed.";
  }
  if (error.code === "BOT_BUSY") {
    return "SlamDunk is busy processing games and images. Try again shortly.";
  }
  const seconds = Math.max(1, Math.ceil(error.retryAfterMs / 1_000));
  return `You are using commands too quickly. Try again in ${seconds}s.`;
}

export function createAbuseGuard({
  policies = DEFAULT_POLICIES,
  maximumHeavyOperations = 4,
  now = Date.now,
  onViolation = null,
} = {}) {
  const windows = new Map();
  const inFlight = new Set();
  let heavyOperations = 0;

  const report = (event) => {
    try {
      const pending = onViolation?.(Object.freeze(event));
      pending?.catch?.((error) => {
        console.error(`Security event logging failed: ${error.message}`);
      });
    } catch (error) {
      console.error(`Security event logging failed: ${error.message}`);
    }
  };

  function consumeWindow(key, policy, timestamp) {
    if (!policy) return;
    const active = (windows.get(key) ?? []).filter(
      (entry) => timestamp - entry < policy.windowMs,
    );
    if (active.length >= policy.limit) {
      const retryAfterMs = Math.max(1, policy.windowMs - (timestamp - active[0]));
      throw new AbuseGuardError(
        "RATE_LIMITED",
        "Command rate limit exceeded.",
        { retryAfterMs },
      );
    }
    active.push(timestamp);
    windows.set(key, active);
  }

  function consumeRateLimit(scope) {
    const timestamp = now();
    consumeWindow(
      `${scope.kind}:${scope.userId}:${scope.guildId}:${scope.commandName}`,
      policies[scope.kind] ?? policies.command,
      timestamp,
    );
    consumeWindow(`guild:${scope.guildId}`, policies.guild, timestamp);
    consumeWindow("global", policies.global, timestamp);
  }

  function acquire(input) {
    const scope = identity(input);
    try {
      consumeRateLimit(scope);
      const singleFlight = input.singleFlight ??
        (scope.kind !== "autocomplete" && SINGLE_FLIGHT_COMMANDS.has(scope.commandName));
      const heavy = input.heavy ?? HEAVY_COMMANDS.has(scope.commandName);
      const flightKey = `${scope.userId}:${scope.commandName}`;
      if (singleFlight && inFlight.has(flightKey)) {
        throw new AbuseGuardError(
          "OPERATION_IN_PROGRESS",
          "A matching operation is already in progress.",
        );
      }
      if (heavy && heavyOperations >= maximumHeavyOperations) {
        throw new AbuseGuardError("BOT_BUSY", "Heavy operation capacity reached.");
      }
      if (singleFlight) inFlight.add(flightKey);
      if (heavy) heavyOperations += 1;
      let released = false;
      return Object.freeze({
        release() {
          if (released) return;
          released = true;
          if (singleFlight) inFlight.delete(flightKey);
          if (heavy) heavyOperations = Math.max(0, heavyOperations - 1);
        },
      });
    } catch (error) {
      if (error instanceof AbuseGuardError) {
        report({ ...scope, eventType: error.code, retryAfterMs: error.retryAfterMs });
      }
      throw error;
    }
  }

  return Object.freeze({
    acquire,
    messageFor: userMessage,
    snapshot() {
      return Object.freeze({
        heavyOperations,
        inFlightOperations: inFlight.size,
        trackedRateWindows: windows.size,
      });
    },
    stop() {
      windows.clear();
      inFlight.clear();
      heavyOperations = 0;
    },
  });
}
