import assert from "node:assert/strict";
import test from "node:test";

import { createBattleTimeline } from "../src/bot/battle/battle-timeline.js";

test("Battle timeline separates action, shot result, and rebound into short lines", () => {
  const timeline = createBattleTimeline([{
    possession: 1,
    offenseTeam: 1,
    action: "DRIVE",
    result: "MISS",
    shotType: "FINISHING",
    points: 0,
    handler: { cardName: "Guard" },
    shooter: { cardName: "Guard" },
    primaryDefender: { cardName: "Defender" },
    shotDefender: { cardName: "Center" },
    rebounder: { cardName: "Center" },
    reboundTeam: 2,
    score: { 1: 0, 2: 0 },
  }]);

  assert.equal(timeline.length, 4);
  assert.match(timeline[0].description, /^🔸/u);
  assert.match(timeline[0].description, /attacks the lane/);
  assert.match(timeline[1].description, /tries a contested/);
  assert.match(timeline[2].description, /misses the attempt/);
  assert.match(timeline[3].description, /^🔹/u);
  assert.match(timeline[3].description, /defensive rebound/);
  assert.ok(timeline.every((line) => /`[^`]+`/.test(line.description)));
  assert.equal(timeline[0].completesPossession, false);
  assert.equal(timeline[3].completesPossession, true);
});

test("Battle timeline renders a structured action chain without duplicating its pass", () => {
  const timeline = createBattleTimeline([{
    possession: 8,
    offenseTeam: 2,
    phase: "HALF_COURT",
    coverage: "DROP",
    action: "THREE_POINT",
    result: "MAKE",
    shotType: "THREE_POINT",
    shotQuality: "OPEN",
    points: 3,
    handler: { cardName: "Floor General" },
    shooter: { cardName: "Wing Shooter" },
    primaryDefender: { cardName: "Point Defender" },
    shotDefender: { cardName: "Wing Defender" },
    assister: { cardName: "Floor General" },
    actionChain: [
      {
        sequence: 1,
        action: "DRIBBLE_HANDOFF",
        actor: { cardName: "Floor General" },
        receiver: { cardName: "Wing Shooter" },
        screener: null,
        defender: { cardName: "Point Defender" },
      },
      {
        sequence: 2,
        action: "RELOCATE",
        actor: { cardName: "Wing Shooter" },
        receiver: null,
        screener: null,
        defender: { cardName: "Wing Defender" },
      },
    ],
    traitActivations: [],
    score: { 1: 4, 2: 7 },
  }]);

  assert.equal(timeline.length, 4);
  assert.match(timeline[0].description, /^🔹/u);
  assert.match(timeline[0].description, /`Floor General`/);
  assert.match(timeline[0].description, /`Wing Shooter`/);
  assert.match(timeline[1].description, /relocates/);
  assert.match(timeline[2].description, /attempts an open three-pointer/);
  assert.match(timeline[3].description, /\+3 points/);
  assert.equal(
    timeline.filter((line) => /hands the ball|moves the ball|extra pass|kicks the ball/.test(
      line.description,
    )).length,
    1,
  );
  assert.deepEqual(timeline[0].score, { 1: 0, 2: 0 });
  assert.deepEqual(timeline[3].score, { 1: 4, 2: 7 });
  assert.equal(timeline[3].completesPossession, true);
});

test("Battle timeline renders an action chain before a turnover result", () => {
  const timeline = createBattleTimeline([{
    possession: 3,
    offenseTeam: 1,
    action: "TURNOVER",
    attemptedAction: "POST_KICK_OUT",
    result: "TURNOVER",
    handler: { cardName: "Post Hub" },
    primaryDefender: { cardName: "Post Defender" },
    stealBy: { cardName: "Help Defender" },
    actionChain: [{
      sequence: 1,
      action: "POST_UP",
      actor: { cardName: "Post Hub" },
      receiver: null,
      screener: null,
      defender: { cardName: "Post Defender" },
    }],
    traitActivations: [],
    score: { 1: 2, 2: 2 },
  }]);

  assert.equal(timeline.length, 2);
  assert.match(timeline[0].description, /^🔸/u);
  assert.match(timeline[0].description, /backs `Post Defender`/);
  assert.equal(timeline[0].completesPossession, false);
  assert.match(timeline[1].description, /^🔹/u);
  assert.match(timeline[1].description, /steals the ball/);
  assert.equal(timeline[1].completesPossession, true);
});

test("Battle timeline narrates tip-off and post-score check-in actions", () => {
  const common = {
    offenseTeam: 1,
    action: "THREE_POINT",
    result: "MAKE",
    shotType: "THREE_POINT",
    shotQuality: "OPEN",
    points: 3,
    handler: { cardName: "Main Guard" },
    shooter: { cardName: "Main Guard" },
    primaryDefender: { cardName: "Defender" },
    shotDefender: { cardName: "Defender" },
    assister: null,
    traitActivations: [],
  };
  const timeline = createBattleTimeline([
    {
      ...common,
      possession: 1,
      actionChain: [{
        sequence: 1,
        action: "TIP_OFF",
        actor: { cardName: "Center One" },
        receiver: { cardName: "Main Guard" },
        screener: null,
        defender: { cardName: "Center Two" },
      }],
      score: { 1: 3, 2: 0 },
    },
    {
      ...common,
      possession: 2,
      actionChain: [{
        sequence: 1,
        action: "CHECK_IN",
        actor: { cardName: "Inbound Center" },
        receiver: { cardName: "Main Guard" },
        screener: null,
        defender: null,
      }],
      score: { 1: 6, 2: 0 },
    },
  ]);

  assert.match(timeline[0].description, /wins the opening tip/);
  assert.match(timeline[0].description, /`Main Guard` controls the ball/);
  assert.match(timeline[3].description, /receives the check-in pass/);
  assert.match(timeline[3].description, /`Inbound Center`/);
});
