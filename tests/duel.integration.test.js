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
import { createEconomyService } from "../src/modules/economy/index.js";
import { createLineupService } from "../src/modules/lineup/index.js";
import { createPlayerService } from "../src/modules/player/index.js";
import { createTraitService } from "../src/modules/trait/index.js";

const SLOTS = ["PG", "SG", "SF", "PF", "C"];
const DUEL_ID = "3a038642a1404d938a3dc5b401f17c23";
const MATCH_ID = "4a038642a1404d938a3dc5b401f17c23";

test("Friendly Duel persists two real lineups without economy progression", async () => {
  const pool = createPostgresPool({
    connectionString: getDatabaseConfig().databaseUrl,
  });
  const database = await pool.connect();
  const economyService = createEconomyService({ databasePool: pool });
  const cardTemplateService = createCardTemplateService({ databasePool: pool });
  const playerService = createPlayerService({ databasePool: pool });
  const cardInstanceService = createCardInstanceService({
    databasePool: pool,
    cardTemplateService,
    playerService,
  });
  const lineupService = createLineupService({ databasePool: pool });
  const traitService = createTraitService({ databasePool: pool, cardTemplateService });
  const runId = Date.now().toString();
  const interactionId = `776${runId}`;

  try {
    await database.query("BEGIN");
    const playerRows = await database.query(
      `
        INSERT INTO players (discord_user_id, username_snapshot)
        VALUES ($1, 'DuelChallenger'), ($2, 'DuelOpponent')
        RETURNING player_id, username_snapshot
      `,
      [`774${runId}`, `775${runId}`],
    );
    const [challenger, challenged] = playerRows.rows;
    await economyService.ensureWallet(challenger.player_id, { database });
    await economyService.ensureWallet(challenged.player_id, { database });
    const ownedCards = new Map([
      [challenger.player_id, []],
      [challenged.player_id, []],
    ]);

    for (let index = 0; index < SLOTS.length; index += 1) {
      const slot = SLOTS[index];
      const template = await cardTemplateService.createTemplate({
        playerName: `Duel ${slot} ${runId}`,
        primaryPosition: slot,
        secondaryPosition: null,
        rarityCode: "COMMON",
        overall: 80 + index,
        finishing: 78 + index,
        midRange: 77 + index,
        threePoint: 76 + index,
        playmaking: 79 + index,
        perimeterDefense: 77 + index,
        interiorDefense: 76 + index,
        strength: 78 + index,
        heightCm: 185 + index * 5,
        packable: true,
      }, { database });
      for (const owner of [challenger, challenged]) {
        const mint = await cardInstanceService.mintCard({
          cardTemplateId: template.cardTemplateId,
          ownerPlayerId: owner.player_id,
          cardLevel: 5,
          obtainedMethod: "ADMIN_GRANT",
        }, { database });
        ownedCards.get(owner.player_id).push(mint.instance.cardInstanceId);
        await lineupService.setCard({
          playerId: owner.player_id,
          slot,
          cardInstanceId: mint.instance.cardInstanceId,
        }, { database });
      }
    }

    const service = createBattleService({
      databasePool: pool,
      lineupService,
      cardInstanceService,
      cardTemplateService,
      traitService,
      playerService,
      economyService,
      battleConfig: gameConfig.battle,
      generateSeed: () => 654321,
      generateDuelId: () => DUEL_ID,
      generateMatchId: () => MATCH_ID,
    });
    const invitation = await service.createDuelChallenge({
      challengerPlayerId: challenger.player_id,
      challengedPlayerId: challenged.player_id,
      interactionId,
    }, { database });
    assert.equal(invitation.challenge.status, "PENDING");

    const duel = await service.acceptDuelChallenge({
      publicDuelId: DUEL_ID,
      playerId: challenged.player_id,
    }, { database });
    assert.equal(duel.challenge.status, "ACCEPTED");
    assert.equal(duel.result.match.mode, "PVP_FRIENDLY_5V5");
    assert.equal(duel.result.match.publicMatchId, MATCH_ID);
    assert.equal(duel.result.reward, null);
    assert.equal(duel.result.teams.length, 2);
    assert.equal(duel.result.teams[0].teamName, "DuelChallenger");
    assert.equal(duel.result.teams[1].teamName, "DuelOpponent");
    assert.ok(duel.result.teams.every((team) => team.players.length === 5));

    const progression = await database.query(
      `SELECT games_played, xp, current_win_streak FROM players
       WHERE player_id = ANY($1::bigint[]) ORDER BY player_id`,
      [[challenger.player_id, challenged.player_id]],
    );
    assert.ok(progression.rows.every((row) =>
      row.games_played === 0 && row.xp === "0" && row.current_win_streak === 0
    ));
    const wallets = await database.query(
      `SELECT gold_balance FROM wallets
       WHERE player_id = ANY($1::bigint[]) ORDER BY player_id`,
      [[challenger.player_id, challenged.player_id]],
    );
    assert.ok(wallets.rows.every((row) => row.gold_balance === "0"));
    const records = await database.query(
      `SELECT games_played, games_won, games_lost FROM player_duel_records
       WHERE player_id = ANY($1::bigint[]) ORDER BY player_id`,
      [[challenger.player_id, challenged.player_id]],
    );
    assert.equal(records.rows.length, 2);
    assert.ok(records.rows.every((row) => row.games_played === 1));
    assert.equal(
      records.rows.reduce((sum, row) => sum + row.games_won, 0),
      1,
    );
    const cardGames = await database.query(
      `SELECT games_played FROM card_instances
       WHERE owner_player_id = ANY($1::bigint[])`,
      [[challenger.player_id, challenged.player_id]],
    );
    assert.equal(cardGames.rows.length, 10);
    assert.ok(cardGames.rows.every((row) => row.games_played === 1));

    const replay = await service.acceptDuelChallenge({
      publicDuelId: DUEL_ID,
      playerId: challenged.player_id,
    }, { database });
    assert.equal(replay.result.match.matchId, duel.result.match.matchId);
    const replayRecords = await database.query(
      `SELECT games_played FROM player_duel_records
       WHERE player_id = ANY($1::bigint[])`,
      [[challenger.player_id, challenged.player_id]],
    );
    assert.ok(replayRecords.rows.every((row) => row.games_played === 1));
  } finally {
    await database.query("ROLLBACK");
    database.release();
    await pool.end();
  }
});
