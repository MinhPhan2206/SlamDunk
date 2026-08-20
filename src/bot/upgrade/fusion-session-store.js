import { randomUUID } from "node:crypto";

const SESSION_TTL_MS = 60_000;
const sessions = new Map();

export const fusionSessionStore = Object.freeze({
  create({ viewerId, cardTemplateId, sourceCardIds }) {
    const sessionId = randomUUID().replaceAll("-", "").slice(0, 16);
    const timer = setTimeout(() => sessions.delete(sessionId), SESSION_TTL_MS);
    timer.unref?.();
    sessions.set(sessionId, Object.freeze({
      viewerId: String(viewerId),
      cardTemplateId: String(cardTemplateId),
      sourceCardIds: Object.freeze(sourceCardIds.map(String)),
      timer,
    }));
    return sessionId;
  },

  get(sessionId) {
    return sessions.get(String(sessionId)) ?? null;
  },

  delete(sessionId) {
    const session = sessions.get(String(sessionId));
    if (session) clearTimeout(session.timer);
    sessions.delete(String(sessionId));
  },
});
