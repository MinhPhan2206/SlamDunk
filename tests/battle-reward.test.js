import assert from "node:assert/strict";
import test from "node:test";

import { gameConfig } from "../src/config/game-config.js";
import { calculateBattleReward } from "../src/modules/battle/battle-reward.js";

const bracket = (code) => gameConfig.battle.opponentBrackets.find(
  (entry) => entry.code === code,
);

test("Battle loss reward uses score and resets the win streak", () => {
  const reward = calculateBattleReward({
    playerScore: 17,
    aiScore: 21,
    currentWinStreak: 4,
    completedBattlesToday: 0,
    bracket: bracket("pro"),
    config: gameConfig.battle,
  });

  assert.equal(reward.baseGold, 640);
  assert.equal(reward.rewardGold, 640);
  assert.equal(reward.winStreakAfter, 0);
  assert.equal(reward.streakBonusBasisPoints, 0);
});

test("Battle win reward applies bracket and bounded streak bonuses", () => {
  const reward = calculateBattleReward({
    playerScore: 21,
    aiScore: 15,
    currentWinStreak: 9,
    completedBattlesToday: 0,
    bracket: bracket("legend"),
    config: gameConfig.battle,
  });

  assert.equal(reward.baseGold, 1_300);
  assert.equal(reward.streakBonusBasisPoints, 5_000);
  assert.equal(reward.rewardGold, 2_730);
  assert.equal(reward.winStreakAfter, 10);
});

test("Battle reward is reduced after sixteen completed Battles in a UTC day", () => {
  const reward = calculateBattleReward({
    playerScore: 21,
    aiScore: 20,
    currentWinStreak: 0,
    completedBattlesToday: 16,
    bracket: bracket("pro"),
    config: gameConfig.battle,
  });

  assert.equal(reward.battleNumberToday, 17);
  assert.equal(reward.reducedReward, true);
  assert.equal(reward.rewardGold, 275);
});
