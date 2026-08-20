import { randomUUID } from "node:crypto";

const SESSION_TTL_MS = 60_000;
const sessions = new Map();

function scheduleExpiry(sessionId, session) {
  clearTimeout(session.timer);
  session.timer = setTimeout(() => sessions.delete(sessionId), SESSION_TTL_MS);
  session.timer.unref?.();
}

export const compareSessionStore = Object.freeze({
  create({ viewerId, sides }) {
    const sessionId = randomUUID().replaceAll("-", "").slice(0, 16);
    const session = { viewerId: String(viewerId), sides: { ...sides }, timer: null };
    sessions.set(sessionId, session);
    scheduleExpiry(sessionId, session);
    return sessionId;
  },

  get(sessionId) {
    const session = sessions.get(String(sessionId));
    if (!session) return null;
    scheduleExpiry(String(sessionId), session);
    return session;
  },

  select(sessionId, side, cardTemplateId) {
    const session = this.get(sessionId);
    if (!session || !["a", "b"].includes(side)) return null;
    const current = session.sides[side];
    const selected = current?.candidates?.find(
      (card) => card.cardTemplateId === String(cardTemplateId),
    );
    if (!selected) return null;
    session.sides[side] = { mode: "template", card: selected };
    return session;
  },

  delete(sessionId) {
    const session = sessions.get(String(sessionId));
    if (session) clearTimeout(session.timer);
    sessions.delete(String(sessionId));
  },
});
