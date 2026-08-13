import assert from "node:assert/strict";
import test from "node:test";

import { gameConfig } from "../src/config/game-config.js";
import {
  ACTIONS,
  calculateThreePointShotProbability,
  simulateBattle,
} from "../src/modules/battle/battle-engine.js";
import { APPROVED_BATTLE_TRAIT_CODES } from "../src/modules/battle/battle-trait-resolver.js";
import { DEFAULT_LINEUP_STRATEGY } from "../src/modules/lineup/lineup-strategy.js";

const SLOTS = ["PG", "SG", "SF", "PF", "C"];

function team(prefix, adjustment = 0) {
  return SLOTS.map((slot, index) => ({
    slot,
    cardInstanceId: prefix === "Player" ? String(index + 1) : null,
    cardTemplateId: String(index + 101 + adjustment),
    cardLevel: prefix === "Player" ? index + 1 : 3,
    cardName: `${prefix} ${slot}`,
    traits: [],
    stats: {
      finishing: 74 + index + adjustment,
      midRange: 73 + index + adjustment,
      threePoint: 72 + index + adjustment,
      playmaking: 75 + index + adjustment,
      perimeterDefense: 74 + index + adjustment,
      interiorDefense: 73 + index + adjustment,
      strength: 75 + index + adjustment,
      heightCm: 188 + index * 5,
    },
  }));
}

test("Battle Engine v3 is deterministic and produces a valid first-to-21 result", () => {
  const input = {
    playerTeam: team("Player", 2),
    aiTeam: team("AI"),
    seed: 123456,
    config: gameConfig.battle,
  };
  const first = simulateBattle(input);
  const second = simulateBattle(input);

  assert.deepEqual(second, first);
  assert.equal(first.engineVersion, "3.3.0");
  assert.equal(first.strategyResolverVersion, "battle-strategy-v4");
  assert.equal(first.traitResolverVersion, "battle-traits-v4");
  assert.equal(first.tendencyResolverVersion, "battle-tendencies-v2");
  assert.equal(first.playByPlay.length, first.possessionCount);
  assert.ok(first.playerScore >= 21 || first.aiScore >= 21);
  assert.equal(first.winnerTeam, first.playerScore >= 21 ? 1 : 2);

  const validActions = new Set([...Object.values(ACTIONS), "TURNOVER"]);
  assert.ok(first.playByPlay.every((event) => validActions.has(event.action)));
  assert.ok(first.playByPlay.every((event) =>
    event.handler?.slot && event.primaryDefender?.slot
  ));
  assert.ok(first.playByPlay
    .filter((event) => event.action !== "TURNOVER")
    .every((event) => event.shooter?.slot && event.shotDefender?.slot));
  assert.ok(first.playByPlay.every((event) =>
    ["HALF_COURT", "TRANSITION", "SECOND_CHANCE"].includes(event.phase) &&
    typeof event.coverage === "string" &&
    event.actionChain.length >= 1 &&
    event.actionChain.length <= gameConfig.battle.maximumActionChainLength &&
    event.actionChain.every((step) => Object.values(ACTIONS).includes(step.action))
  ));

  for (const [players, score] of [
    [first.playerTeam, first.playerScore],
    [first.aiTeam, first.aiScore],
  ]) {
    assert.equal(players.reduce((sum, player) => sum + player.points, 0), score);
    for (const player of players) {
      assert.ok(player.fieldGoalsMade <= player.fieldGoalsAttempted);
      assert.ok(player.threePointersMade <= player.threePointersAttempted);
      assert.ok(player.threePointersMade <= player.fieldGoalsMade);
      assert.ok(player.threePointersAttempted <= player.fieldGoalsAttempted);
    }
  }
});

test("Three-point accuracy separates weak and elite shooters by shot quality", () => {
  const expected = [
    [60, 0.3525, 0.2925, 0.2125, 0.1425],
    [75, 0.42, 0.36, 0.28, 0.21],
    [90, 0.5025, 0.4425, 0.3625, 0.2925],
    [99, 0.552, 0.492, 0.412, 0.342],
  ];
  for (const [rating, open, light, contested, heavy] of expected) {
    for (const [shotQuality, probability] of [
      ["OPEN", open],
      ["LIGHTLY_CONTESTED", light],
      ["CONTESTED", contested],
      ["HEAVILY_CONTESTED", heavy],
    ]) {
      assert.ok(Math.abs(calculateThreePointShotProbability({
        threePointRating: rating,
        shotQuality,
        config: gameConfig.battle,
      }) - probability) < 1e-10);
    }
  }
});

test("Battle Engine v3 terminates safely across representative seeds", () => {
  for (let seed = 1; seed <= 100; seed += 1) {
    const result = simulateBattle({
      playerTeam: team("Player", 1),
      aiTeam: team("AI"),
      seed,
      config: gameConfig.battle,
    });
    assert.ok(result.possessionCount <= gameConfig.battle.maximumPossessions);
    assert.ok(result.playerScore >= 21 || result.aiScore >= 21);
  }
});

test("Battle Engine v3 exercises expanded actions, phases, and coverages", () => {
  const actions = new Set();
  const phases = new Set();
  const coverages = new Set();
  for (let seed = 1; seed <= 120; seed += 1) {
    const result = simulateBattle({
      playerTeam: team("Player", 1),
      aiTeam: team("AI"),
      seed,
      config: gameConfig.battle,
    });
    for (const event of result.playByPlay) {
      phases.add(event.phase);
      coverages.add(event.coverage);
      for (const step of event.actionChain) actions.add(step.action);
    }
  }

  for (const action of Object.values(ACTIONS)) assert.ok(actions.has(action), action);
  assert.deepEqual(phases, new Set(["HALF_COURT", "TRANSITION", "SECOND_CHANCE"]));
  assert.ok(coverages.has("SWITCH"));
  assert.ok(coverages.has("DROP"));
  assert.ok(coverages.size >= 5);
});

test("Tip-off and check-in deliver the ball to each strategy's Main Handler", () => {
  const playerStrategy = {
    ...DEFAULT_LINEUP_STRATEGY,
    mainHandler: "SG",
  };
  const aiStrategy = {
    ...DEFAULT_LINEUP_STRATEGY,
    mainHandler: "PF",
  };
  const result = simulateBattle({
    playerTeam: team("Player", 1),
    aiTeam: team("AI"),
    playerStrategy,
    aiStrategy,
    seed: 13579,
    config: gameConfig.battle,
  });

  const opening = result.playByPlay[0];
  const tipOff = opening.actionChain[0];
  const openingStrategy = opening.offenseTeam === 1 ? playerStrategy : aiStrategy;
  assert.equal(tipOff.action, "TIP_OFF");
  assert.equal(tipOff.actor.slot, "C");
  assert.equal(tipOff.defender.slot, "C");
  assert.equal(tipOff.receiver.slot, openingStrategy.mainHandler);
  assert.equal(opening.handler.slot, openingStrategy.mainHandler);

  const madeIndex = result.playByPlay.findIndex((event, index) =>
    event.result === "MAKE" && index < result.playByPlay.length - 1
  );
  assert.ok(madeIndex >= 0);
  const scoringEvent = result.playByPlay[madeIndex];
  const nextEvent = result.playByPlay[madeIndex + 1];
  const receivingStrategy = scoringEvent.offenseTeam === 1
    ? aiStrategy
    : playerStrategy;
  assert.equal(nextEvent.actionChain[0].action, "CHECK_IN");
  assert.equal(nextEvent.actionChain[0].receiver.slot, receivingStrategy.mainHandler);
  assert.equal(nextEvent.handler.slot, receivingStrategy.mainHandler);
});

test("Battle Engine v3 wires approved Trait effects into possession telemetry", () => {
  const traitTeam = team("Player", 1).map((player) => ({
    ...player,
    traits: APPROVED_BATTLE_TRAIT_CODES.map((traitCode) => ({
      traitCode,
      traitTier: 3,
      active: true,
    })),
  }));
  const result = simulateBattle({
    playerTeam: traitTeam,
    aiTeam: team("AI"),
    playerStrategy: {
      ...DEFAULT_LINEUP_STRATEGY,
      offense: "MOTION",
    },
    seed: 24680,
    config: gameConfig.battle,
  });
  const activations = result.playByPlay.flatMap((event) => event.traitActivations);

  assert.ok(activations.length > 0);
  assert.ok(activations.every((activation) =>
    APPROVED_BATTLE_TRAIT_CODES.includes(activation.traitCode)
  ));
  assert.ok(activations.some((activation) => activation.hook === "ACTION_SELECTION"));
  assert.ok(activations.some((activation) => activation.hook === "SHOT_QUALITY"));
});

test("Battle Engine v3 activates all seven situational Traits from live game state", () => {
  const situationalCodes = [
    "TOUGH_SHOT_MAKER",
    "CONTACT_FINISHER",
    "CLUTCH_PERFORMER",
    "CLUTCH_DEFENDER",
    "COMEBACK_CATALYST",
    "MOMENTUM_SCORER",
    "COLD_BLOODED",
  ];
  const withTraits = (prefix, adjustment) => team(prefix, adjustment).map((player) => ({
    ...player,
    traits: situationalCodes.map((traitCode) => ({
      traitCode,
      traitTier: 3,
      active: true,
    })),
  }));
  const activations = new Set();
  for (let seed = 1; seed <= 160 && activations.size < situationalCodes.length; seed += 1) {
    const result = simulateBattle({
      playerTeam: withTraits("Player", 1),
      aiTeam: withTraits("AI", 0),
      seed,
      config: gameConfig.battle,
    });
    for (const event of result.playByPlay) {
      for (const activation of event.traitActivations) {
        if (situationalCodes.includes(activation.traitCode)) {
          activations.add(activation.traitCode);
        }
      }
    }
  }
  assert.deepEqual([...activations].sort(), [...situationalCodes].sort());
});

test("Pass-first Tendencies produce more passing actions than score-first Tendencies", () => {
  const passActions = new Set([
    "PASS",
    "EXTRA_PASS",
    "DRIVE_AND_KICK",
    "POST_KICK_OUT",
    "PICK_AND_ROLL",
    "DRIBBLE_HANDOFF",
    "RESET_OFFENSE",
  ]);
  const profile = (decision) => ({
    schemaVersion: "tendency-v1",
    decision,
    shotProfile: "BALANCED",
    creationRole: "BALANCED",
    usage: "NORMAL",
  });
  let passFirstActions = 0;
  let passFirstTotal = 0;
  let scoreFirstActions = 0;
  let scoreFirstTotal = 0;
  for (let seed = 1; seed <= 120; seed += 1) {
    const input = {
      aiTeam: team("AI"),
      seed,
      config: gameConfig.battle,
    };
    const passFirst = simulateBattle({
      ...input,
      playerTeam: team("Player", 1),
      playerStrategy: {
        ...DEFAULT_LINEUP_STRATEGY,
        playerTendencies: Object.fromEntries(
          ["1", "2", "3", "4", "5"].map((id) => [id, profile("PASS_FIRST")]),
        ),
      },
    });
    const scoreFirst = simulateBattle({
      ...input,
      playerTeam: team("Player", 1),
      playerStrategy: {
        ...DEFAULT_LINEUP_STRATEGY,
        playerTendencies: Object.fromEntries(
          ["1", "2", "3", "4", "5"].map((id) => [id, profile("SCORE_FIRST")]),
        ),
      },
    });
    for (const event of passFirst.playByPlay.filter((entry) => entry.offenseTeam === 1)) {
      passFirstTotal += 1;
      passFirstActions += Number(passActions.has(event.attemptedAction ?? event.action));
    }
    for (const event of scoreFirst.playByPlay.filter((entry) => entry.offenseTeam === 1)) {
      scoreFirstTotal += 1;
      scoreFirstActions += Number(passActions.has(event.attemptedAction ?? event.action));
    }
  }
  assert.ok(passFirstActions / passFirstTotal > scoreFirstActions / scoreFirstTotal);
});

test("Pace & Space increases three-point attempt share across deterministic seed batches", () => {
  const paceSpace = {
    ...DEFAULT_LINEUP_STRATEGY,
    offense: "PACE_SPACE",
    tempo: "QUICK",
  };
  let balancedPerimeter = 0;
  let balancedTotal = 0;
  let pacePerimeter = 0;
  let paceTotal = 0;

  for (let seed = 1; seed <= 200; seed += 1) {
    const input = {
      playerTeam: team("Player", 1),
      aiTeam: team("AI"),
      seed,
      config: gameConfig.battle,
    };
    const balanced = simulateBattle(input);
    const pace = simulateBattle({ ...input, playerStrategy: paceSpace });
    for (const event of balanced.playByPlay.filter((entry) => entry.offenseTeam === 1)) {
      balancedTotal += 1;
      balancedPerimeter += Number(event.shotType === "THREE_POINT");
    }
    for (const event of pace.playByPlay.filter((entry) => entry.offenseTeam === 1)) {
      paceTotal += 1;
      pacePerimeter += Number(event.shotType === "THREE_POINT");
    }
  }

  assert.ok(
    pacePerimeter / paceTotal > balancedPerimeter / balancedTotal,
    `pace=${pacePerimeter}/${paceTotal}; balanced=${balancedPerimeter}/${balancedTotal}`,
  );
});
