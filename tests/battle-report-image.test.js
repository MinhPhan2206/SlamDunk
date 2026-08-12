import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateMvpScore,
  createBattleReportImage,
  selectGameLeaders,
  selectGameMvp,
} from "../src/bot/battle/battle-report-image.js";

const SLOTS = ["PG", "SG", "SF", "PF", "C"];

function teamPlayers(prefix) {
  return SLOTS.map((slot, index) => ({
    slot,
    cardName: index === 0
      ? `${prefix} Extremely Long Basketball Player Name`
      : `${prefix} Player ${index + 1}`,
    points: index * 2,
    rebounds: index,
    assists: 4 - index,
    steals: index % 2,
    blocks: 0,
    turnovers: 1,
    fieldGoalsMade: index,
    fieldGoalsAttempted: index + 2,
    threePointersMade: 0,
    threePointersAttempted: index,
  }));
}

function fixture() {
  const playerTeam = teamPlayers("Player");
  const aiTeam = teamPlayers("AI");
  return {
    match: {
      inputSnapshot: {
        playerTeam: playerTeam.map((player) => ({
          slot: player.slot,
          rarityCode: "UNCOMMON",
          rarityName: "Uncommon",
          cardLevel: 3,
        })),
        aiTeam: aiTeam.map((player) => ({
          slot: player.slot,
          rarityCode: "SUPERSTAR",
          rarityName: "Superstar",
          cardLevel: 4,
        })),
      },
    },
    teams: [
      { teamNumber: 1, finalScore: 16, players: playerTeam },
      { teamNumber: 2, finalScore: 22, players: aiTeam },
    ],
    reward: { bracketName: "Legend" },
  };
}

test("Battle report selects MVP from the winning team by box-score impact", () => {
  const result = fixture();
  const mvp = selectGameMvp(result);

  assert.equal(mvp.teamNumber, 2);
  assert.equal(mvp.slot, "PF");
  assert.equal(mvp.rarityCode, "SUPERSTAR");
  assert.ok(Math.abs(calculateMvpScore(mvp) - 11.6) < 1e-9);
});

test("Battle report selects leaders across both teams", () => {
  const leaders = selectGameLeaders(fixture());

  assert.equal(leaders.scoring.slot, "C");
  assert.equal(leaders.rebounding.slot, "C");
  assert.equal(leaders.playmaking.slot, "PG");
  assert.equal(leaders.defense.slot, "PF");
});

test("Battle report renderer creates the redesigned fixed-size PNG", async () => {
  const result = fixture();

  const output = await createBattleReportImage(result, {
    ownerDisplayName: "A Discord Display Name That Is Too Long",
  });

  assert.deepEqual([...output.subarray(1, 4)], [80, 78, 71]);
  assert.equal(output.readUInt32BE(16), 1_200);
  assert.equal(output.readUInt32BE(20), 1_400);
  assert.ok(output.length > 10_000);
});
