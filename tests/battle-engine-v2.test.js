import assert from "node:assert/strict";
import test from "node:test";

import { gameConfig } from "../src/config/game-config.js";
import { ACTIONS, simulateBattle } from "../src/modules/battle/battle-engine.js";

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

test("Battle Engine v2 is deterministic and produces a valid first-to-21 result", () => {
  const input = {
    playerTeam: team("Player", 2),
    aiTeam: team("AI"),
    seed: 123456,
    config: gameConfig.battle,
  };
  const first = simulateBattle(input);
  const second = simulateBattle(input);

  assert.deepEqual(second, first);
  assert.equal(first.engineVersion, "2.0.0");
  assert.equal(first.playByPlay.length, first.possessionCount);
  assert.ok(first.playerScore >= 21 || first.aiScore >= 21);
  assert.equal(first.winnerTeam, first.playerScore >= 21 ? 1 : 2);

  const validActions = new Set([...Object.values(ACTIONS), "TURNOVER"]);
  assert.ok(first.playByPlay.every((event) => validActions.has(event.action)));

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

test("Battle Engine v2 terminates safely across representative seeds", () => {
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
