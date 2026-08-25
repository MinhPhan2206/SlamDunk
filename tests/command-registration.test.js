import assert from "node:assert/strict";
import test from "node:test";

import {
  registerCommands,
  resolveRegistrationRoute,
} from "../scripts/register-commands.js";

test("development command registration targets one Guild", async () => {
  const requests = [];
  const config = {
    scope: "development",
    token: "test-token",
    clientId: "11111111111111111",
    guildId: "22222222222222222",
  };

  await registerCommands("development", {
    commandDefinitions: [{ data: { toJSON: () => ({ name: "ping" }) } }],
    configProvider: () => config,
    restClient: { put: async (route, options) => requests.push({ route, options }) },
    logger: { log() {} },
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].route, resolveRegistrationRoute(config));
  assert.deepEqual(requests[0].options.body, [{ name: "ping" }]);
  assert.match(requests[0].route, /guilds/);
});

test("production command registration targets the global Application route", async () => {
  const requests = [];
  const config = {
    scope: "production",
    token: "test-token",
    clientId: "11111111111111111",
  };

  await registerCommands("production", {
    commandDefinitions: [{ data: { toJSON: () => ({ name: "ping" }) } }],
    configProvider: () => config,
    restClient: { put: async (route, options) => requests.push({ route, options }) },
    logger: { log() {} },
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].route, resolveRegistrationRoute(config));
  assert.deepEqual(requests[0].options.body, [{ name: "ping" }]);
  assert.doesNotMatch(requests[0].route, /guilds/);
});
