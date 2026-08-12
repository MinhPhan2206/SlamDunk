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
    bracket: bracket("pro"),
    config: gameConfig.battle,
  });

  assert.equal(reward.baseGold, 505);
  assert.equal(reward.rewardGold, 505);
  assert.equal(reward.winStreakAfter, 0);
  assert.equal(reward.streakBonusBasisPoints, 0);
});

test("Battle win reward applies bracket and progressive uncapped streak bonuses", () => {
  const reward = calculateBattleReward({
    playerScore: 21,
    aiScore: 15,
    currentWinStreak: 9,
    bracket: bracket("legend"),
    config: gameConfig.battle,
  });

  assert.equal(reward.baseGold, 1_220);
  assert.equal(reward.fixedBaseGold, 950);
  assert.equal(reward.scoreBonusGold, 270);
  assert.equal(reward.bracketAdjustmentGold, 488);
  assert.equal(reward.streakBonusBasisPoints, 4_000);
  assert.equal(reward.streakBonusGold, 683);
  assert.equal(reward.rewardGold, 2_391);
  assert.equal(reward.winStreakAfter, 10);
});

test("Battle streak bonus grows by 5%, 3%, then 2% without a cap", () => {
  const bonusAt = (currentWinStreak) => calculateBattleReward({
    playerScore: 21,
    aiScore: 16,
    currentWinStreak,
    bracket: bracket("pro"),
    config: gameConfig.battle,
  }).streakBonusBasisPoints;

  assert.equal(bonusAt(0), 500);
  assert.equal(bonusAt(4), 2_500);
  assert.equal(bonusAt(9), 4_000);
  assert.equal(bonusAt(19), 6_000);
  assert.equal(bonusAt(49), 12_000);
});

test("Battle rewards are never reduced by a daily Battle limit", () => {
  const reward = calculateBattleReward({
    playerScore: 21,
    aiScore: 20,
    currentWinStreak: 0,
    bracket: bracket("pro"),
    config: gameConfig.battle,
  });

  assert.equal(reward.rewardGold, 1_044);
  assert.equal("reducedReward" in reward, false);
});

test("sixteen competitive Pro Battles produce the 17k-19k target", () => {
  let currentWinStreak = 0;
  let totalGold = 0;
  for (let battle = 1; battle <= 16; battle += 1) {
    const won = battle % 4 !== 0;
    const reward = calculateBattleReward({
      playerScore: won ? 21 : 17,
      aiScore: won ? 16 : 21,
      currentWinStreak,
      bracket: bracket("pro"),
      config: gameConfig.battle,
    });
    totalGold += reward.rewardGold;
    currentWinStreak = reward.winStreakAfter;
  }

  assert.ok(totalGold >= 17_000 && totalGold <= 19_000);
});
