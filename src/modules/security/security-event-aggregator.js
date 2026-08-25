function normalizeText(value, fallback = null) {
  const normalized = value == null ? "" : String(value).trim();
  return normalized || fallback;
}

function aggregateKey(event) {
  return [
    event.eventType,
    event.discordUserId ?? "unknown",
    event.guildId ?? "dm",
    event.commandName ?? "unknown",
    event.kind ?? "unknown",
  ].join(":");
}

function mergeAggregate(target, source) {
  target.count += source.count;
  target.firstSeenAt = Math.min(target.firstSeenAt, source.firstSeenAt);
  target.lastSeenAt = Math.max(target.lastSeenAt, source.lastSeenAt);
  target.maximumRetryAfterMs = Math.max(
    target.maximumRetryAfterMs,
    source.maximumRetryAfterMs,
  );
  target.channelId = source.channelId ?? target.channelId;
}

export function createSecurityEventAggregator({
  writeEvents,
  flushIntervalMs = 60_000,
  maximumPendingKeys = 2_000,
  maximumEventsPerFlush = 500,
  now = Date.now,
  scheduleRecurring = setInterval,
  cancelRecurring = clearInterval,
} = {}) {
  if (typeof writeEvents !== "function") {
    throw new TypeError("Security event aggregator requires writeEvents.");
  }
  for (const [name, value] of Object.entries({
    flushIntervalMs,
    maximumPendingKeys,
    maximumEventsPerFlush,
  })) {
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new TypeError(`${name} must be a positive integer.`);
    }
  }

  const pending = new Map();
  let timer = null;
  let activeFlush = null;
  let recordedEvents = 0;
  let persistedEvents = 0;
  let persistedAggregates = 0;
  let droppedEvents = 0;
  let flushFailures = 0;

  function record(input) {
    const timestamp = now();
    const event = {
      eventType: normalizeText(input?.eventType, "UNKNOWN").toUpperCase(),
      severity: normalizeText(input?.severity, "WARNING").toUpperCase(),
      discordUserId: normalizeText(input?.discordUserId),
      guildId: normalizeText(input?.guildId),
      channelId: normalizeText(input?.channelId),
      commandName: normalizeText(input?.commandName),
      kind: normalizeText(input?.metadata?.kind, "unknown"),
      retryAfterMs: Number.isFinite(Number(input?.metadata?.retryAfterMs))
        ? Math.max(0, Number(input.metadata.retryAfterMs))
        : 0,
    };
    const key = aggregateKey(event);
    const current = pending.get(key);
    recordedEvents += 1;
    if (current) {
      current.count += 1;
      current.lastSeenAt = timestamp;
      current.maximumRetryAfterMs = Math.max(
        current.maximumRetryAfterMs,
        event.retryAfterMs,
      );
      current.channelId = event.channelId ?? current.channelId;
      return true;
    }
    if (pending.size >= maximumPendingKeys) {
      droppedEvents += 1;
      return false;
    }
    pending.set(key, {
      ...event,
      count: 1,
      firstSeenAt: timestamp,
      lastSeenAt: timestamp,
      maximumRetryAfterMs: event.retryAfterMs,
    });
    return true;
  }

  async function flush() {
    if (activeFlush) return activeFlush;
    const selected = [...pending.entries()].slice(0, maximumEventsPerFlush);
    if (selected.length === 0) return 0;
    selected.forEach(([key]) => pending.delete(key));
    const events = selected.map(([, aggregate]) => ({
      eventType: aggregate.eventType,
      severity: aggregate.severity,
      discordUserId: aggregate.discordUserId,
      guildId: aggregate.guildId,
      channelId: aggregate.channelId,
      commandName: aggregate.commandName,
      metadata: {
        kind: aggregate.kind,
        count: aggregate.count,
        firstSeenAt: new Date(aggregate.firstSeenAt).toISOString(),
        lastSeenAt: new Date(aggregate.lastSeenAt).toISOString(),
        maximumRetryAfterMs: aggregate.maximumRetryAfterMs,
        aggregated: true,
      },
    }));
    activeFlush = (async () => {
      try {
        await writeEvents(events);
        persistedAggregates += events.length;
        persistedEvents += selected.reduce(
          (total, [, aggregate]) => total + aggregate.count,
          0,
        );
        return events.length;
      } catch (error) {
        flushFailures += 1;
        for (const [key, aggregate] of selected) {
          const current = pending.get(key);
          if (current) mergeAggregate(current, aggregate);
          else if (pending.size < maximumPendingKeys) pending.set(key, aggregate);
          else droppedEvents += aggregate.count;
        }
        throw error;
      } finally {
        activeFlush = null;
      }
    })();
    return activeFlush;
  }

  return Object.freeze({
    record,
    flush,
    start() {
      if (timer) return;
      timer = scheduleRecurring(() => {
        void flush().catch((error) => {
          console.error(`Aggregated security event flush failed: ${error.message}`);
        });
      }, flushIntervalMs);
      timer.unref?.();
    },
    async stop() {
      if (timer) {
        cancelRecurring(timer);
        timer = null;
      }
      while (pending.size > 0) await flush();
      if (activeFlush) await activeFlush;
    },
    snapshot() {
      let pendingEvents = 0;
      for (const aggregate of pending.values()) pendingEvents += aggregate.count;
      return Object.freeze({
        pendingKeys: pending.size,
        pendingEvents,
        maximumPendingKeys,
        recordedEvents,
        persistedEvents,
        persistedAggregates,
        droppedEvents,
        flushFailures,
      });
    },
  });
}
