import { TopGgError } from "./topgg.errors.js";

const API_BASE_URL = "https://top.gg/api/v1";

function discordId(value, fieldName) {
  const normalized = String(value ?? "");
  if (!/^\d{17,20}$/.test(normalized)) {
    throw new TypeError(`${fieldName} must be a Discord ID.`);
  }
  return normalized;
}

function parseVote(payload) {
  const createdAt = new Date(payload?.created_at);
  const expiresAt = new Date(payload?.expires_at);
  const weight = payload?.weight;
  if (
    Number.isNaN(createdAt.getTime()) ||
    Number.isNaN(expiresAt.getTime()) ||
    !Number.isSafeInteger(weight) ||
    weight <= 0
  ) {
    throw new TopGgError(
      "TOPGG_INVALID_RESPONSE",
      "Top.gg returned an invalid vote response.",
    );
  }
  return Object.freeze({ createdAt, expiresAt, weight });
}

export function createTopGgClient({ apiToken, fetchImpl = globalThis.fetch }) {
  if (typeof fetchImpl !== "function") {
    throw new TypeError("Top.gg client requires fetch.");
  }
  const token = apiToken?.trim() || null;

  return Object.freeze({
    async getActiveVote(discordUserId) {
      if (!token) {
        throw new TopGgError(
          "TOPGG_NOT_CONFIGURED",
          "Top.gg voting is not configured yet.",
        );
      }
      const userId = discordId(discordUserId, "discordUserId");
      let response;
      try {
        response = await fetchImpl(
          `${API_BASE_URL}/projects/@me/votes/${userId}?source=discord`,
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(5_000),
          },
        );
      } catch (error) {
        if (error instanceof TopGgError) throw error;
        throw new TopGgError(
          "TOPGG_UNAVAILABLE",
          "Top.gg could not be reached. Please try again shortly.",
        );
      }
      if (response.status === 404) return null;
      if (!response.ok) {
        throw new TopGgError(
          response.status === 401
            ? "TOPGG_AUTHENTICATION_FAILED"
            : "TOPGG_UNAVAILABLE",
          response.status === 401
            ? "Top.gg authentication failed."
            : "Top.gg could not verify your vote. Please try again shortly.",
        );
      }
      let payload;
      try {
        payload = await response.json();
      } catch {
        throw new TopGgError(
          "TOPGG_INVALID_RESPONSE",
          "Top.gg returned an invalid vote response.",
        );
      }
      const vote = parseVote(payload);
      return vote.expiresAt > new Date() ? vote : null;
    },
  });
}
