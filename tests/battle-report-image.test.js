import assert from "node:assert/strict";
import test from "node:test";

import { createBattleReportImage } from "../src/bot/battle/battle-report-image.js";

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

test("Battle report renderer creates a fixed-size PNG for two complete teams", async () => {
  const playerTeam = teamPlayers("Player");
  const aiTeam = teamPlayers("AI");
  const result = {
    match: {
      inputSnapshot: {
        playerTeam: playerTeam.map((player) => ({
          slot: player.slot,
          rarityName: "Uncommon",
        })),
        aiTeam: aiTeam.map((player) => ({
          slot: player.slot,
          rarityName: "Superstar",
        })),
      },
    },
    teams: [
      { teamNumber: 1, finalScore: 16, players: playerTeam },
      { teamNumber: 2, finalScore: 22, players: aiTeam },
    ],
  };

  const output = await createBattleReportImage(result, {
    ownerDisplayName: "A Discord Display Name That Is Too Long",
  });

  assert.deepEqual([...output.subarray(1, 4)], [80, 78, 71]);
  assert.equal(output.readUInt32BE(16), 824);
  assert.equal(output.readUInt32BE(20), 1_024);
  assert.ok(output.length > 10_000);
});
