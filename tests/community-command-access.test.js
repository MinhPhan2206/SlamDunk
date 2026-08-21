import assert from "node:assert/strict";
import test from "node:test";

import {
  battleAccessError,
  duelBetAccessError,
  tradeAccessError,
} from "../src/bot/access/community-access.js";

const access = Object.freeze({
  guildId: "111111111111111111",
  tradeChannelIds: ["211111111111111111"],
  battleChannelIds: ["311111111111111111"],
  duelBetChannelIds: ["411111111111111111"],
});

function location(guildId, channelId) {
  return { guildId, channelId };
}

test("Trade is restricted to its Community Server channels", () => {
  assert.equal(
    tradeAccessError(location(access.guildId, access.tradeChannelIds[0]), access),
    null,
  );
  assert.match(
    tradeAccessError(location("999999999999999999", access.tradeChannelIds[0]), access),
    /Community Server trade channels/,
  );
});

test("Battle is restricted only while inside the Community Server", () => {
  assert.equal(
    battleAccessError(location("999999999999999999", "888888888888888888"), access),
    null,
  );
  assert.match(
    battleAccessError(location(access.guildId, "888888888888888888"), access),
    /Community Server channels/,
  );
  assert.equal(
    battleAccessError(location(access.guildId, access.battleChannelIds[0]), access),
    null,
  );
});

test("Wagered Duel is restricted to its Community Server channels", () => {
  assert.equal(
    duelBetAccessError(location(access.guildId, access.duelBetChannelIds[0]), access),
    null,
  );
  assert.match(
    duelBetAccessError(location("999999999999999999", "888888888888888888"), access),
    /Wagered Duels/,
  );
});
