import assert from "node:assert/strict";
import test from "node:test";

import { MessageFlags } from "discord.js";

import { strategyComponent } from "../src/bot/components/strategy.component.js";
import { createStrategyDraftStore } from "../src/bot/strategy/strategy-draft-store.js";
import {
  DEFAULT_LINEUP_STRATEGY,
  LineupError,
} from "../src/modules/lineup/index.js";

const OWNER_ID = "234567890123456789";

function createSession(store, overrides = {}) {
  return store.create({
    ownerDiscordUserId: OWNER_ID,
    playerId: "7",
    lineupId: "9",
    strategy: DEFAULT_LINEUP_STRATEGY,
    strategyRevision: 4,
    players: [{ slot: "PG", cardInstanceId: "101", playerName: "Test Guard" }],
    ...overrides,
  });
}

function interaction(customId, { userId = OWNER_ID, values } = {}) {
  const calls = [];
  const select = values !== undefined;
  return {
    calls,
    value: {
      customId,
      values,
      user: { id: userId },
      isButton() { return !select; },
      isStringSelectMenu() { return select; },
      async deferUpdate() { calls.push(["defer"]); },
      async editReply(payload) { calls.push(["edit", payload]); },
      async followUp(payload) { calls.push(["followUp", payload]); },
      async reply(payload) { calls.push(["reply", payload]); },
    },
  };
}

test("Strategy owner customizes a draft and saves with optimistic revision", async () => {
  const store = createStrategyDraftStore();
  const session = createSession(store);
  let saveInput;
  const services = {
    lineup: {
      async saveStrategy(input) {
        saveInput = input;
        return {
          lineupId: "9",
          strategy: input.strategy,
          strategyRevision: 5,
        };
      },
    },
  };

  try {
    const handler = interaction(`strategy:handler:${session.sessionId}`, {
      values: ["SG"],
    });
    await strategyComponent.execute(handler.value, {
      services,
      strategyDrafts: store,
    });
    assert.equal(store.get(session.sessionId).draftStrategy.mainHandler, "SG");

    const tendencies = interaction(`strategy:tendencies:${session.sessionId}`);
    await strategyComponent.execute(tendencies.value, {
      services,
      strategyDrafts: store,
    });
    assert.equal(store.get(session.sessionId).view, "tendencyPlayer");
    assert.equal(store.get(session.sessionId).selectedTendencyCardId, "101");
    assert.equal(tendencies.calls[1][1].components.length, 4);

    const shotCategory = interaction(`strategy:editShot:${session.sessionId}`);
    await strategyComponent.execute(shotCategory.value, {
      services,
      strategyDrafts: store,
    });
    assert.equal(
      store.get(session.sessionId).selectedTendencyField,
      "shotProfile",
    );

    const decision = interaction(`strategy:decision:${session.sessionId}`, {
      values: ["PASS_FIRST"],
    });
    await strategyComponent.execute(decision.value, {
      services,
      strategyDrafts: store,
    });
    assert.equal(
      store.get(session.sessionId).draftStrategy.playerTendencies["101"].decision,
      "PASS_FIRST",
    );

    const summary = interaction(`strategy:summary:${session.sessionId}`);
    await strategyComponent.execute(summary.value, {
      services,
      strategyDrafts: store,
    });

    const customize = interaction(`strategy:customize:${session.sessionId}`);
    await strategyComponent.execute(customize.value, {
      services,
      strategyDrafts: store,
    });
    assert.equal(customize.calls[1][1].components.length, 5);

    const offense = interaction(`strategy:offense:${session.sessionId}`, {
      values: ["PACE_SPACE"],
    });
    await strategyComponent.execute(offense.value, {
      services,
      strategyDrafts: store,
    });
    assert.match(
      offense.calls[1][1].embeds[0].toJSON().description,
      /Offense · \*\*Pace & Space\*\*/,
    );

    const save = interaction(`strategy:save:${session.sessionId}`);
    await strategyComponent.execute(save.value, {
      services,
      strategyDrafts: store,
    });
    assert.deepEqual(saveInput, {
      playerId: "7",
      lineupId: "9",
      strategy: store.get(session.sessionId).draftStrategy,
      expectedRevision: 4,
    });
    assert.equal(store.get(session.sessionId).strategyRevision, 5);
    assert.equal(store.get(session.sessionId).dirty, false);
    assert.equal(save.calls[1][1].components.length, 2);
    assert.equal(
      save.calls[1][1].components[1].components[2].data.disabled,
      true,
    );
  } finally {
    store.stop();
  }
});

test("Strategy editor is owner-only and Reset remains draft-only", async () => {
  const store = createStrategyDraftStore();
  const session = createSession(store);
  let saves = 0;
  const services = {
    lineup: { async saveStrategy() { saves += 1; } },
  };

  try {
    const denied = interaction(`strategy:customize:${session.sessionId}`, {
      userId: "345678901234567890",
    });
    await strategyComponent.execute(denied.value, {
      services,
      strategyDrafts: store,
    });
    assert.equal(denied.calls[0][0], "reply");
    assert.equal(denied.calls[0][1].flags, MessageFlags.Ephemeral);
    assert.equal(store.get(session.sessionId).view, "summary");

    store.setDraft(session.sessionId, {
      ...DEFAULT_LINEUP_STRATEGY,
      offense: "MOTION",
    });
    const reset = interaction(`strategy:reset:${session.sessionId}`);
    await strategyComponent.execute(reset.value, {
      services,
      strategyDrafts: store,
    });
    assert.deepEqual(
      store.get(session.sessionId).draftStrategy,
      DEFAULT_LINEUP_STRATEGY,
    );
    assert.equal(saves, 0);

    const cancel = interaction(`strategy:cancel:${session.sessionId}`);
    await strategyComponent.execute(cancel.value, {
      services,
      strategyDrafts: store,
    });
    assert.equal(store.get(session.sessionId), null);
    assert.deepEqual(cancel.calls[1][1].components, []);
  } finally {
    store.stop();
  }
});

test("Strategy revision conflict closes the stale editor", async () => {
  const store = createStrategyDraftStore();
  const session = createSession(store);
  store.setDraft(session.sessionId, {
    ...DEFAULT_LINEUP_STRATEGY,
    defense: "SWITCH",
  });
  const conflict = interaction(`strategy:save:${session.sessionId}`);

  try {
    await strategyComponent.execute(conflict.value, {
      strategyDrafts: store,
      services: {
        lineup: {
          async saveStrategy() {
            throw new LineupError(
              "STRATEGY_REVISION_CONFLICT",
              "The strategy changed in another editor.",
            );
          },
        },
      },
    });
    assert.equal(store.get(session.sessionId), null);
    assert.equal(
      conflict.calls[1][1].content,
      "The strategy changed in another editor.",
    );
    assert.deepEqual(conflict.calls[1][1].components, []);
  } finally {
    store.stop();
  }
});

test("Rapid duplicate Save interactions are serialized into one update", async () => {
  const store = createStrategyDraftStore();
  const session = createSession(store);
  store.setDraft(session.sessionId, {
    ...DEFAULT_LINEUP_STRATEGY,
    tempo: "QUICK",
  });
  let releaseSave;
  const saveGate = new Promise((resolve) => { releaseSave = resolve; });
  let saveCalls = 0;
  const services = {
    lineup: {
      async saveStrategy(input) {
        saveCalls += 1;
        await saveGate;
        return {
          lineupId: "9",
          strategy: input.strategy,
          strategyRevision: 5,
        };
      },
    },
  };
  const first = interaction(`strategy:save:${session.sessionId}`);
  const second = interaction(`strategy:save:${session.sessionId}`);

  try {
    const firstRun = strategyComponent.execute(first.value, {
      services,
      strategyDrafts: store,
    });
    const secondRun = strategyComponent.execute(second.value, {
      services,
      strategyDrafts: store,
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(saveCalls, 1);
    releaseSave();
    await Promise.all([firstRun, secondRun]);
    assert.equal(saveCalls, 1);
    assert.equal(store.get(session.sessionId).dirty, false);
    assert.equal(store.get(session.sessionId).strategyRevision, 5);
  } finally {
    store.stop();
  }
});
