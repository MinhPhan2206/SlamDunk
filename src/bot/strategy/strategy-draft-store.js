import { randomBytes } from "node:crypto";

import { normalizeLineupStrategy } from "../../modules/lineup/index.js";

export const STRATEGY_EDITOR_TIMEOUT_MS = 60_000;

const STRATEGY_FIELDS = Object.freeze([
  "mainHandler",
  "playerTendencies",
  "offense",
  "tempo",
  "defense",
  "rebounding",
]);

function strategiesEqual(left, right) {
  return STRATEGY_FIELDS.every((field) => field === "playerTendencies"
    ? JSON.stringify(left[field]) === JSON.stringify(right[field])
    : left[field] === right[field]);
}

function componentData(component) {
  return typeof component.toJSON === "function"
    ? component.toJSON()
    : { ...(component.data ?? component) };
}

function disabledRows(rows) {
  return rows.map((row) => {
    const data = componentData(row);
    return {
      ...data,
      components: (row.components ?? data.components ?? []).map((component) => ({
        ...componentData(component),
        disabled: true,
      })),
    };
  });
}

function expiredEmbeds(embeds) {
  return embeds.map((embed, index) => {
    const data = typeof embed.toJSON === "function"
      ? embed.toJSON()
      : { ...(embed.data ?? embed) };
    return index === embeds.length - 1
      ? { ...data, footer: { text: "Interaction Expired" } }
      : data;
  });
}

async function disableExpiredMessage(message) {
  try {
    const current = typeof message?.fetch === "function"
      ? await message.fetch()
      : message;
    if (!current?.components?.length || typeof current.edit !== "function") return;
    await current.edit({
      components: disabledRows(current.components),
      ...(current.embeds?.length
        ? { embeds: expiredEmbeds(current.embeds) }
        : {}),
    });
  } catch (error) {
    console.warn(`Strategy editor timeout update failed: ${error.message}`);
  }
}

function positiveRevision(value) {
  const revision = Number(value);
  if (!Number.isSafeInteger(revision) || revision < 1) {
    throw new TypeError("strategyRevision must be a positive integer.");
  }
  return revision;
}

export function createStrategyDraftStore({
  timeoutMs = STRATEGY_EDITOR_TIMEOUT_MS,
  schedule = setTimeout,
  cancel = clearTimeout,
  now = Date.now,
} = {}) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError("Strategy editor timeout must be a positive integer.");
  }

  const sessions = new Map();

  function remove(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) return false;
    sessions.delete(sessionId);
    if (session.timer) cancel(session.timer);
    return true;
  }

  async function expire(sessionId, expectedSession) {
    if (sessions.get(sessionId) !== expectedSession) return;
    sessions.delete(sessionId);
    await disableExpiredMessage(expectedSession.message);
  }

  function scheduleExpiry(session) {
    if (session.timer) cancel(session.timer);
    session.expiresAt = now() + timeoutMs;
    session.timer = schedule(() => {
      void expire(session.sessionId, session);
    }, timeoutMs);
    session.timer?.unref?.();
  }

  function get(sessionId) {
    const session = sessions.get(String(sessionId));
    if (!session) return null;
    if (now() >= session.expiresAt) {
      void expire(session.sessionId, session);
      return null;
    }
    return session;
  }

  return Object.freeze({
    create({
      ownerDiscordUserId,
      playerId,
      lineupId,
      strategy,
      strategyRevision,
      players = [],
    }) {
      let sessionId;
      do {
        sessionId = randomBytes(16).toString("hex");
      } while (sessions.has(sessionId));

      const normalizedStrategy = normalizeLineupStrategy(strategy);
      const lineupPlayers = Object.freeze(players.map((player) => Object.freeze({
        slot: String(player.slot),
        cardInstanceId: String(player.cardInstanceId),
        playerName: String(player.playerName),
      })));
      const session = {
        sessionId,
        ownerDiscordUserId: String(ownerDiscordUserId),
        playerId: String(playerId),
        lineupId: String(lineupId),
        strategyRevision: positiveRevision(strategyRevision),
        persistedStrategy: normalizedStrategy,
        draftStrategy: normalizedStrategy,
        dirty: false,
        view: "summary",
        players: lineupPlayers,
        selectedTendencyCardId: lineupPlayers[0]?.cardInstanceId ?? null,
        message: null,
        messageId: null,
        expiresAt: 0,
        timer: null,
        operation: Promise.resolve(),
      };
      sessions.set(sessionId, session);
      scheduleExpiry(session);
      return session;
    },

    get,

    bindMessage(sessionId, message) {
      const session = get(sessionId);
      if (!session || !message) return null;
      session.message = message;
      session.messageId = message.id ? String(message.id) : null;
      return session;
    },

    touch(sessionId) {
      const session = get(sessionId);
      if (!session) return null;
      scheduleExpiry(session);
      return session;
    },

    async run(sessionId, operation) {
      const session = get(sessionId);
      if (!session) return null;
      const result = session.operation.then(async () => {
        if (get(sessionId) !== session) return null;
        return operation(session);
      });
      session.operation = result.catch(() => undefined);
      return result;
    },

    setView(sessionId, view) {
      const session = get(sessionId);
      if (!session || ![
        "summary", "customize", "tendencyPlayers", "tendencyPlayer",
      ].includes(view)) return null;
      session.view = view;
      return session;
    },

    selectTendencyPlayer(sessionId, cardInstanceId) {
      const session = get(sessionId);
      const normalized = String(cardInstanceId);
      if (!session?.players.some((player) =>
        player.cardInstanceId === normalized)) return null;
      session.selectedTendencyCardId = normalized;
      session.view = "tendencyPlayer";
      return session;
    },

    setDraft(sessionId, strategy) {
      const session = get(sessionId);
      if (!session) return null;
      session.draftStrategy = normalizeLineupStrategy(strategy);
      session.dirty = !strategiesEqual(
        session.draftStrategy,
        session.persistedStrategy,
      );
      return session;
    },

    markSaved(sessionId, state) {
      const session = get(sessionId);
      if (!session) return null;
      const strategy = normalizeLineupStrategy(state.strategy);
      session.lineupId = String(state.lineupId ?? session.lineupId);
      session.strategyRevision = positiveRevision(state.strategyRevision);
      session.persistedStrategy = strategy;
      session.draftStrategy = strategy;
      session.dirty = false;
      session.view = "summary";
      return session;
    },

    remove,

    stop() {
      for (const session of sessions.values()) {
        if (session.timer) cancel(session.timer);
      }
      sessions.clear();
    },
  });
}
