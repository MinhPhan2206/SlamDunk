import assert from "node:assert/strict";
import test from "node:test";

import { getDatabaseConfig } from "../src/config/env.js";
import { createPostgresPool } from "../src/database/connection/postgres.js";
import {
  createCardInstanceService,
  createCardTemplateService,
} from "../src/modules/card/index.js";
import { LineupError, createLineupService } from "../src/modules/lineup/index.js";
import { createPlayerService } from "../src/modules/player/index.js";

function templateInput(edition, primaryPosition, secondaryPosition) {
  return {
    playerName: "M11 Test Player",
    edition,
    season: "2026-27",
    primaryPosition,
    secondaryPosition,
    rarityTier: 3,
    overall: 88,
    insideScoring: 80,
    midRange: 80,
    threePoint: 80,
    playmaking: 80,
    perimeterDefense: 80,
    interiorDefense: 80,
    rebounding: 80,
    athleticism: 80,
    heightCm: null,
    weightKg: null,
    packable: false,
    releaseDate: null,
  };
}

test("Lineup enforces ownership, position eligibility, and unique cards", async () => {
  const pool = createPostgresPool({
    connectionString: getDatabaseConfig().databaseUrl,
  });
  const database = await pool.connect();
  const cardTemplateService = createCardTemplateService({ databasePool: pool });
  const playerService = createPlayerService({ databasePool: pool });
  const cardInstanceService = createCardInstanceService({
    databasePool: pool,
    cardTemplateService,
    playerService,
  });
  const lineupService = createLineupService({ databasePool: pool });
  const testRunId = Date.now().toString();

  try {
    await database.query("BEGIN");
    const sfTemplate = await cardTemplateService.createTemplate(
      templateInput(`M11 SF ${testRunId}`, "SF", "PF"),
      { database },
    );
    const pfTemplate = await cardTemplateService.createTemplate(
      templateInput(`M11 PF ${testRunId}`, "PF", "C"),
      { database },
    );
    const playerResult = await database.query(
      `INSERT INTO players (discord_user_id, username_snapshot)
       VALUES ($1, 'M11LineupOwner') RETURNING player_id`,
      [`988${testRunId}`],
    );
    const playerId = playerResult.rows[0].player_id;
    const firstCard = await cardInstanceService.mintCard(
      {
        cardTemplateId: sfTemplate.cardTemplateId,
        ownerPlayerId: playerId,
        cardLevel: 2,
        obtainedMethod: "ADMIN_GRANT",
      },
      { database },
    );
    const secondCard = await cardInstanceService.mintCard(
      {
        cardTemplateId: pfTemplate.cardTemplateId,
        ownerPlayerId: playerId,
        cardLevel: 3,
        obtainedMethod: "ADMIN_GRANT",
      },
      { database },
    );

    await assert.rejects(
      lineupService.setCard(
        { playerId, slot: "PG", cardInstanceId: firstCard.instance.cardInstanceId },
        { database },
      ),
      (error) =>
        error instanceof LineupError &&
        error.code === "CARD_POSITION_INELIGIBLE",
    );

    const firstLineup = await lineupService.setCard(
      { playerId, slot: "SF", cardInstanceId: firstCard.instance.cardInstanceId },
      { database },
    );
    assert.equal(firstLineup.slots.find((slot) => slot.slot === "SF").cardInstanceId, firstCard.instance.cardInstanceId);

    await assert.rejects(
      lineupService.setCard(
        { playerId, slot: "PF", cardInstanceId: firstCard.instance.cardInstanceId },
        { database },
      ),
      (error) =>
        error instanceof LineupError && error.code === "CARD_ALREADY_IN_LINEUP",
    );

    const twoCardLineup = await lineupService.setCard(
      { playerId, slot: "PF", cardInstanceId: secondCard.instance.cardInstanceId },
      { database },
    );
    assert.equal(twoCardLineup.complete, false);
    assert.equal(twoCardLineup.slots.filter((slot) => slot.cardInstanceId).length, 2);

    const afterRemoval = await lineupService.removeCard(
      { playerId, slot: "SF" },
      { database },
    );
    assert.equal(afterRemoval.slots.find((slot) => slot.slot === "SF").cardInstanceId, null);
  } finally {
    await database.query("ROLLBACK");
    const residual = await database.query(
      `SELECT COUNT(1) AS count
       FROM lineups l JOIN players p ON p.player_id = l.player_id
       WHERE p.discord_user_id = $1`,
      [`988${testRunId}`],
    );
    assert.equal(residual.rows[0].count, "0");
    database.release();
    await pool.end();
  }
});
