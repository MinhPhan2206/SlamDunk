import assert from "node:assert/strict";
import test from "node:test";

import { gameConfig } from "../src/config/game-config.js";
import { getDatabaseConfig } from "../src/config/env.js";
import { createPostgresPool } from "../src/database/connection/postgres.js";
import { createEconomyService } from "../src/modules/economy/index.js";
import { createBattleService } from "../src/modules/battle/index.js";
import { deriveBattleSeed } from "../src/modules/battle/battle-strategy.js";
import {
  createCardInstanceService,
  createCardTemplateService,
  createCardViewService,
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
  const economyService = createEconomyService({ databasePool: pool });
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
  const cardViewService = createCardViewService({
    databasePool: pool,
    traitService,
  });
  const testRunId = Date.now().toString();
  const interactionId = `987${testRunId}`;
  const practiceInteractionId = `988${testRunId}`;
  const generatedMatchIds = [
    "0a038642a1404d938a3dc5b401f17c23",
    "1a038642a1404d938a3dc5b401f17c23",
  ];

  try {
    await database.query("BEGIN");
    const playerResult = await database.query(
      `INSERT INTO players (discord_user_id, username_snapshot)
       VALUES ($1, 'M12BattlePlayer') RETURNING player_id`,
      [`986${testRunId}`],
    );
    const playerId = playerResult.rows[0].player_id;
    await economyService.ensureWallet(playerId, { database });
    const templates = [];
    const instances = [];

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
      instances.push(mint.instance);
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
      economyService,
      battleConfig: gameConfig.battle,
      generateSeed: () => 123456,
      generateMatchId: () => generatedMatchIds.shift(),
    });
    const result = await battleService.battle(
      { playerId, interactionId, opponentBracket: "street" },
      { database },
    );

    assert.equal(result.match.status, "COMPLETED");
    assert.equal(result.match.publicMatchId, "0a038642a1404d938a3dc5b401f17c23");
    assert.equal(result.match.engineVersion, gameConfig.battle.engineVersion);
    assert.equal(result.match.rulesetVersion, gameConfig.battle.rulesetVersion);
    assert.equal(
      result.match.inputSnapshot.battleConfig.configVersion,
      gameConfig.battle.configVersion,
    );
    assert.deepEqual(
      result.match.inputSnapshot.aiTeam.map((player) => player.cardLevel),
      [5, 5, 5, 5, 5],
    );
    assert.ok(result.match.inputSnapshot.playerTeam.every((player) =>
      player.overall && player.rarityCode && player.rarityName
    ));
    assert.equal(
      result.match.inputSnapshot.strategySchemaVersion,
      result.match.inputSnapshot.playerStrategy.schemaVersion,
    );
    assert.equal(
      result.match.inputSnapshot.strategyResolverVersion,
      result.match.inputSnapshot.playerStrategy.resolverVersion,
    );
    assert.equal(
      result.match.inputSnapshot.aiStrategy.resolverVersion,
      result.match.inputSnapshot.strategyResolverVersion,
    );
    assert.equal(
      result.match.inputSnapshot.traitResolverVersion,
      gameConfig.battle.traitResolverVersion,
    );
    assert.equal(
      result.match.inputSnapshot.tendencyResolverVersion,
      gameConfig.battle.tendencyResolverVersion,
    );
    assert.equal(
      typeof result.match.inputSnapshot.playerStrategy.playerTendencies,
      "object",
    );
    assert.equal(
      result.match.inputSnapshot.simulationSeed,
      deriveBattleSeed(123456, "simulation"),
    );
    assert.equal(result.match.playByPlay.length, result.match.possessionCount);
    assert.ok(result.match.possessionCount > 0);
    assert.equal(result.reward.bracketCode, "street");
    assert.ok(result.reward.rewardGold >= 1);
    assert.equal(
      result.reward.rewardXp,
      result.match.winnerTeam === 1 ? "150" : "50",
    );
    assert.equal("battleNumberToday" in result.reward, false);
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
      { playerId, interactionId, opponentBracket: "street" },
      { database },
    );
    assert.equal(replay.match.matchId, result.match.matchId);
    assert.equal(replay.replayed, true);
    assert.deepEqual(replay.reward, result.reward);
    assert.deepEqual(replay.match.playByPlay, result.match.playByPlay);

    const playerAfterBattle = await playerService.getPlayerById(playerId, {
      database,
    });
    assert.equal(playerAfterBattle.gamesPlayed, 1);
    assert.equal(playerAfterBattle.gamesWon + playerAfterBattle.gamesLost, 1);
    assert.equal(playerAfterBattle.xp, result.reward.rewardXp);
    assert.equal(playerAfterBattle.playerLevel, 0);
    const xpTransactions = await database.query(
      "SELECT COUNT(*)::integer AS count FROM player_xp_transactions WHERE player_id = $1",
      [playerId],
    );
    assert.equal(xpTransactions.rows[0].count, 1);
    const walletAfterBattle = await economyService.getWallet(playerId, {
      database,
    });
    assert.equal(walletAfterBattle.goldBalance, String(result.reward.rewardGold));
    const cardsAfterBattle = await database.query(
      `SELECT games_played FROM card_instances WHERE owner_player_id = $1`,
      [playerId],
    );
    assert.equal(cardsAfterBattle.rows.length, 5);
    assert.ok(cardsAfterBattle.rows.every((row) => row.games_played === 1));
    const firstCardStats = await cardViewService.getBattleStats(
      instances[0].cardInstanceId,
      { database },
    );
    const firstCardView = await cardViewService.getInstance(
      instances[0].cardInstanceId,
      { database },
    );
    const firstBoxScore = result.teams[0].players[0];
    assert.equal(firstCardStats.gamesPlayed, 1);
    assert.equal(firstCardStats.pointsPerGame, firstBoxScore.points);
    assert.equal(firstCardStats.reboundsPerGame, firstBoxScore.rebounds);
    assert.equal(firstCardView.ownerUsername, "M12BattlePlayer");
    assert.equal(firstCardView.totalMinted, "1");

    const practice = await battleService.practice(
      {
        playerId,
        interactionId: practiceInteractionId,
        opponentBracket: "street",
      },
      { database },
    );
    assert.equal(practice.match.mode, "PRACTICE_5V5");
    assert.equal(practice.match.inputSnapshot.practice, true);
    assert.equal(practice.reward, null);
    assert.equal(practice.match.rewardSnapshot != null, true);
    assert.ok(practice.teams.some((team) => team.finalScore >= 21));
    assert.deepEqual(
      practice.match.inputSnapshot.aiTeam.map((player) => player.cardLevel),
      [2, 2, 2, 2, 2],
    );
    const practiceCooldown = await battleService.getPracticeCooldown(playerId, {
      database,
    });
    assert.equal(practiceCooldown.available, false);

    const playerAfterPractice = await playerService.getPlayerById(playerId, {
      database,
    });
    const walletAfterPractice = await economyService.getWallet(playerId, {
      database,
    });
    const cardsAfterPractice = await database.query(
      `SELECT games_played FROM card_instances WHERE owner_player_id = $1`,
      [playerId],
    );
    assert.equal(playerAfterPractice.gamesPlayed, playerAfterBattle.gamesPlayed);
    assert.equal(playerAfterPractice.xp, playerAfterBattle.xp);
    assert.equal(walletAfterPractice.goldBalance, walletAfterBattle.goldBalance);
    assert.ok(cardsAfterPractice.rows.every((row) => row.games_played === 1));
    await assert.rejects(
      battleService.practice(
        {
          playerId,
          interactionId: `989${testRunId}`,
          opponentBracket: "street",
        },
        { database },
      ),
      (error) => error.code === "PRACTICE_COOLDOWN_ACTIVE",
    );
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
