import assert from "node:assert/strict";
import test from "node:test";

import { gameConfig } from "../src/config/game-config.js";
import { getDatabaseConfig } from "../src/config/env.js";
import { createPostgresPool } from "../src/database/connection/postgres.js";
import {
  createCardInstanceService,
  createCardTemplateService,
} from "../src/modules/card/index.js";
import { DropError, createDropService } from "../src/modules/drop/index.js";
import { createPlayerService } from "../src/modules/player/index.js";

function createTemplateInput(edition, overall) {
  return {
    playerName: "M9 Test Player",
    edition,
    season: "2026-27",
    primaryPosition: "PG",
    secondaryPosition: "SG",
    rarityTier: 1,
    overall,
    insideScoring: 75,
    midRange: 80,
    threePoint: 85,
    playmaking: 88,
    perimeterDefense: 76,
    interiorDefense: 35,
    rebounding: 45,
    athleticism: 82,
    heightCm: 190,
    weightKg: 83,
    packable: true,
    releaseDate: "2026-08-04",
  };
}

test("Free Drop persists candidates and mints only one selected Card Instance", async () => {
  const pool = createPostgresPool({
    connectionString: getDatabaseConfig().databaseUrl,
  });
  const database = await pool.connect();
  const baseCardTemplateService = createCardTemplateService({
    databasePool: pool,
  });
  const playerService = createPlayerService({ databasePool: pool });
  const cardInstanceService = createCardInstanceService({
    databasePool: pool,
    cardTemplateService: baseCardTemplateService,
    playerService,
  });
  const testRunId = Date.now().toString();
  const interactionId = `991${testRunId}`;

  try {
    await database.query("BEGIN");

    const templates = [];
    for (let index = 1; index <= 3; index += 1) {
      templates.push(
        await baseCardTemplateService.createTemplate(
          createTemplateInput(`M9 Candidate ${index} ${testRunId}`, 70 + index),
          { database },
        ),
      );
    }

    const playerResult = await database.query(
      `
        INSERT INTO players (discord_user_id, username_snapshot)
        VALUES ($1, 'M9DropOwner')
        RETURNING player_id
      `,
      [`992${testRunId}`],
    );
    const playerId = playerResult.rows[0].player_id;
    const packableTemplates =
      await baseCardTemplateService.listPackableTemplates({ database });
    const packableTemplateIds = new Set(
      packableTemplates.map((template) => template.cardTemplateId),
    );
    assert.ok(
      templates.every((template) =>
        packableTemplateIds.has(template.cardTemplateId),
      ),
    );
    const cardTemplateService = {
      ...baseCardTemplateService,
      async listPackableTemplates() {
        return templates;
      },
    };
    const dropService = createDropService({
      databasePool: pool,
      cardInstanceService,
      cardTemplateService,
      dropConfig: gameConfig.drop,
      rollInteger(minimum, maximumExclusive) {
        assert.ok(maximumExclusive > minimum);
        return minimum;
      },
    });

    const offer = await dropService.createOffer(
      { playerId, interactionId },
      { database },
    );

    assert.equal(offer.session.status, "OPEN");
    assert.equal(offer.candidates.length, 3);
    assert.equal(new Set(offer.candidates.map((item) => item.cardTemplateId)).size, 3);

    const replayedOffer = await dropService.createOffer(
      { playerId, interactionId },
      { database },
    );
    assert.equal(replayedOffer.session.dropSessionId, offer.session.dropSessionId);
    assert.equal(replayedOffer.replayed, true);

    const otherInteractionOffer = await dropService.createOffer(
      { playerId, interactionId: `990${testRunId}` },
      { database },
    );
    assert.equal(
      otherInteractionOffer.session.dropSessionId,
      offer.session.dropSessionId,
    );

    const transactionTimeResult = await database.query(
      "SELECT CURRENT_TIMESTAMP AS current_time",
    );
    await database.query(
      "UPDATE drop_sessions SET selection_expires_at = CURRENT_TIMESTAMP - INTERVAL '1 second' WHERE drop_session_id = $1",
      [offer.session.dropSessionId],
    );
    const selection = await dropService.confirmSelection(
      {
        playerId,
        dropSessionId: offer.session.dropSessionId,
        candidatePosition: 2,
      },
      { database },
    );

    assert.equal(selection.session.status, "COMPLETED");
    assert.equal(selection.resultInstance.ownerPlayerId, playerId);
    assert.equal(selection.resultInstance.obtainedMethod, "DROP");
    assert.equal(selection.resultInstance.cardLevel, 1);
    assert.equal(selection.resultInstance.serialNumber, "1");
    assert.equal(
      selection.session.selectedTemplateId,
      offer.candidates[0].cardTemplateId,
    );
    assert.equal(
      selection.cooldown.availableAt.getTime() -
        transactionTimeResult.rows[0].current_time.getTime(),
      15 * 60_000,
    );

    const instanceCount = await database.query(
      `
        SELECT COUNT(*) AS instance_count
        FROM card_instances
        WHERE owner_player_id = $1 AND obtained_method = 'DROP'
      `,
      [playerId],
    );
    assert.equal(instanceCount.rows[0].instance_count, "1");

    const replayedSelection = await dropService.confirmSelection(
      {
        playerId,
        dropSessionId: offer.session.dropSessionId,
        candidatePosition: 1,
      },
      { database },
    );
    assert.equal(replayedSelection.resultInstance.cardInstanceId, selection.resultInstance.cardInstanceId);
    assert.equal(replayedSelection.replayed, true);

    await assert.rejects(
      dropService.confirmSelection(
        {
          playerId,
          dropSessionId: offer.session.dropSessionId,
          candidatePosition: 2,
        },
        { database },
      ),
      (error) =>
        error instanceof DropError && error.code === "DROP_ALREADY_COMPLETED",
    );

    await assert.rejects(
      dropService.createOffer(
        { playerId, interactionId: `989${testRunId}` },
        { database },
      ),
      (error) =>
        error instanceof DropError &&
        error.code === "FREE_DROP_COOLDOWN_ACTIVE",
    );
  } finally {
    await database.query("ROLLBACK");
    const residualSessions = await database.query(
      `
        SELECT COUNT(*) AS session_count
        FROM drop_sessions ds
        JOIN players p ON p.player_id = ds.player_id
        WHERE p.discord_user_id = $1
      `,
      [`992${testRunId}`],
    );
    assert.equal(residualSessions.rows[0].session_count, "0");
    database.release();
    await pool.end();
  }
});
