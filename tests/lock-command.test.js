import assert from "node:assert/strict";
import test from "node:test";

import { lockCommand } from "../src/bot/commands/lock.command.js";
import { unlockCommand } from "../src/bot/commands/unlock.command.js";

test("lock command accepts a Collection position and protects the resolved card", async () => {
  const replies = [];
  const interaction = {
    user: { id: "234567890123456789", username: "LockTester" },
    options: { getString: () => "2" },
    async deferReply(payload) { replies.push({ type: "defer", payload }); },
    async editReply(payload) { replies.push({ type: "edit", payload }); },
  };
  const services = {
    player: { async getOrCreatePlayer() { return { playerId: "7" }; } },
    collection: {
      async resolveOwnedCardReference(input) {
        assert.deepEqual(input, { playerId: "7", cardReference: "2" });
        return "42";
      },
    },
    cardInstance: {
      async lockOwnedCard(input) {
        assert.deepEqual(input, { ownerPlayerId: "7", cardInstanceId: "42" });
        return { publicCardId: "123456789", userLock: true };
      },
    },
  };

  await lockCommand.execute(interaction, { services });

  assert.match(replies[1].payload, /!123456789/);
});

test("unlock command accepts a public Card ID and removes protection", async () => {
  const replies = [];
  const interaction = {
    user: { id: "234567890123456789", username: "LockTester" },
    options: { getString: () => "!123456789" },
    async deferReply(payload) { replies.push({ type: "defer", payload }); },
    async editReply(payload) { replies.push({ type: "edit", payload }); },
  };
  const services = {
    player: { async getOrCreatePlayer() { return { playerId: "7" }; } },
    collection: {
      async resolveOwnedCardReference(input) {
        assert.deepEqual(input, {
          playerId: "7",
          cardReference: "!123456789",
        });
        return "42";
      },
    },
    cardInstance: {
      async unlockOwnedCard(input) {
        assert.deepEqual(input, { ownerPlayerId: "7", cardInstanceId: "42" });
        return { publicCardId: "123456789", userLock: false };
      },
    },
  };

  await unlockCommand.execute(interaction, { services });

  assert.match(replies[1].payload, /unlocked/);
});
