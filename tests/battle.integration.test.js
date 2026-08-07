import assert from "node:assert/strict";
import test from "node:test";

import { gameConfig } from "../src/config/game-config.js";
import { getDatabaseConfig } from "../src/config/env.js";
import { createPostgresPool } from "../src/database/connection/postgres.js";
import { createBattleService } from "../src/modules/battle/index.js";
import {
  createCardInstanceService,
  createCardTemplateService,
} from "../src/modules/card/index.js";
import { createLineupService } from "../src/modules/lineup/index.js";
import { createPlayerService } from "../src/modules/player/index.js";
import { createTraitService } from "../src/modules/trait/index.js";

const SLOTS = ["PG", "SG", "SF", "PF", "C"];

function templateInput(slot, index, testRunId) {
  return {
    playerName: `M12 ${slot} Player ${testRunId}`,
    primaryPosition: slot,
    secondaryPosition: null,
    rarityCode: "COMMON",
    overall: 82 + index,
    finishing: 75 + index,
    midRange: 76 + index,
    threePoint: 74 + index,
    playmaking: 77 + index,
    perimeterDefense: 75 + index,
    interiorDefense: 73 + index,
    strength: 76 + index,
    heightCm: null,
    packable: true,
  };
}

test("Battle persists snapshots and applies one idempotent result", async () => {
  const pool = createPostgresPool({
    connectionString: getDatabaseConfig().databaseUrl,
  });
  const database = await pool.connect();
  const baseCardTemplateService = createCardTemplateService({ databasePool: pool });
  const playerService = createPlayerService({ databasePool: pool });
  const cardInstanceService = createCardInstanceService({
    databasePool: pool,
    cardTemplateService: baseCardTemplateService,
    playerService,
  });
  const lineupService = createLineupService({ databasePool: pool });
  const traitService = createTraitService({
    databasePool: pool,
    cardTemplateService: baseCardTemplateService,
  });
  const testRunId = Date.now().toString();
  const interactionId = `987${testRunId}`;

  try {
    await database.query("BEGIN");
    const playerResult = await database.query(
      `INSERT INTO players (discord_user_id, username_snapshot)
       VALUES ($1, 'M12BattlePlayer') RETURNING player_id`,
      [`986${testRunId}`],
    );
    const playerId = playerResult.rows[0].player_id;
    const templates = [];

    for (let index = 0; index < SLOTS.length; index += 1) {
      const slot = SLOTS[index];
      const template = await baseCardTemplateService.createTemplate(
        templateInput(slot, index, testRunId),
        { database },
      );
      templates.push(template);
      const mint = await cardInstanceService.mintCard(
        {
          cardTemplateId: template.cardTemplateId,
          ownerPlayerId: playerId,
          cardLevel: index + 1,
          obtainedMethod: "ADMIN_GRANT",
        },
        { database },
      );
      await lineupService.setCard(
        { playerId, slot, cardInstanceId: mint.instance.cardInstanceId },
        { database },
      );
    }

    const cardTemplateService = {
      ...baseCardTemplateService,
      async listPackableTemplates() {
        return templates;
      },
    };
    const battleService = createBattleService({
      databasePool: pool,
      lineupService,
      cardInstanceService,
      cardTemplateService,
      traitService,
      playerService,
      battleConfig: gameConfig.battle,
      generateSeed: () => 123456,
      generateMatchId: () => "0a038642a1404d938a3dc5b401f17c23",
    });
    const result = await battleService.battle(
      { playerId, interactionId },
      { database },
    );

    assert.equal(result.match.status, "COMPLETED");
    assert.equal(result.match.publicMatchId, "0a038642a1404d938a3dc5b401f17c23");
    assert.equal(result.match.engineVersion, "2.0.0");
    assert.equal(result.match.rulesetVersion, "first-to-21-v1");
    assert.equal(result.match.inputSnapshot.battleConfig.configVersion, "battle-v2-playtest-1");
    assert.ok(result.match.inputSnapshot.playerTeam.every((player) =>
      player.overall && player.rarityCode && player.rarityName
    ));
    assert.equal(result.match.playByPlay.length, result.match.possessionCount);
    assert.ok(result.match.possessionCount > 0);
    assert.ok(result.teams.some((team) => team.finalScore >= 21));
    assert.equal(result.teams.length, 2);
    for (const team of result.teams) {
      assert.equal(team.players.length, 5);
      assert.equal(
        team.players.reduce((sum, player) => sum + player.points, 0),
        team.finalScore,
      );
      assert.ok(team.players.every((player) =>
        player.fieldGoalsMade <= player.fieldGoalsAttempted &&
        player.threePointersMade <= player.threePointersAttempted &&
        player.threePointersMade <= player.fieldGoalsMade
      ));
    }

    const replay = await battleService.battle(
      { playerId, interactionId },
      { database },
    );
    assert.equal(replay.match.matchId, result.match.matchId);
    assert.equal(replay.replayed, true);
    assert.deepEqual(replay.match.playByPlay, result.match.playByPlay);

    const playerAfterBattle = await playerService.getPlayerById(playerId, {
      database,
    });
    assert.equal(playerAfterBattle.gamesPlayed, 1);
    assert.equal(playerAfterBattle.gamesWon + playerAfterBattle.gamesLost, 1);
    const cardsAfterBattle = await database.query(
      `SELECT games_played FROM card_instances WHERE owner_player_id = $1`,
      [playerId],
    );
    assert.equal(cardsAfterBattle.rows.length, 5);
    assert.ok(cardsAfterBattle.rows.every((row) => row.games_played === 1));
  } finally {
    await database.query("ROLLBACK");
    const residual = await database.query(
      `SELECT COUNT(1) AS count FROM matches WHERE request_interaction_id = $1`,
      [interactionId],
    );
    assert.equal(residual.rows[0].count, "0");
    database.release();
    await pool.end();
  }
});
