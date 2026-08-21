import assert from "node:assert/strict";
import test from "node:test";

import { createTopGgClient, TopGgError } from "../src/integrations/topgg/index.js";

const USER_ID = "111111111111111111";

test("Top.gg client verifies a current vote with Bearer authentication", async () => {
  const expiresAt = new Date(Date.now() + 60_000).toISOString();
  const client = createTopGgClient({
    apiToken: "secret-token",
    async fetchImpl(url, options) {
      assert.equal(
        url,
        `https://top.gg/api/v1/projects/@me/votes/${USER_ID}?source=discord`,
      );
      assert.equal(options.headers.Authorization, "Bearer secret-token");
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            created_at: new Date().toISOString(),
            expires_at: expiresAt,
            weight: 2,
          };
        },
      };
    },
  });
  const vote = await client.getActiveVote(USER_ID);
  assert.equal(vote.weight, 2);
  assert.equal(vote.expiresAt.toISOString(), expiresAt);
});

test("Top.gg client maps no active vote and missing configuration", async () => {
  const noVote = createTopGgClient({
    apiToken: "secret-token",
    async fetchImpl() { return { ok: false, status: 404 }; },
  });
  assert.equal(await noVote.getActiveVote(USER_ID), null);

  const unconfigured = createTopGgClient({ apiToken: null });
  await assert.rejects(
    unconfigured.getActiveVote(USER_ID),
    (error) => error instanceof TopGgError && error.code === "TOPGG_NOT_CONFIGURED",
  );
});
