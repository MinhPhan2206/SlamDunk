import assert from "node:assert/strict";
import test from "node:test";

import { getTestDatabaseConfig } from "../src/config/env.js";
import { createPostgresPool } from "../src/database/connection/postgres.js";
import {
  CardError,
  createCardInstanceService,
  createCardTemplateService,
} from "../src/modules/card/index.js";
import { createPlayerService } from "../src/modules/player/index.js";
import { createCollectionService } from "../src/modules/collection/index.js";

function createTemplateInput(edition) {
  return {
    playerName: `M8 Test Player ${edition}`,
    primaryPosition: "SF",
    secondaryPosition: "PF",
    rarityCode: "SUPERSTAR",
    overall: 94,
    finishing: 88,
    midRange: 90,
    threePoint: 87,
    playmaking: 82,
    perimeterDefense: 89,
    interiorDefense: 78,
    strength: 86,
    heightCm: 203,
    packable: true,
  };
}

test("Card Instances receive per-template serials and ownership history", async () => {
  const pool = createPostgresPool({
    connectionString: getTestDatabaseConfig().databaseUrl,
  });
  const database = await pool.connect();
  const cardTemplateService = createCardTemplateService({ databasePool: pool });
  const playerService = createPlayerService({ databasePool: pool });
  const cardInstanceService = createCardInstanceService({
    databasePool: pool,
    cardTemplateService,
    playerService,
  });
  const collectionService = createCollectionService({ databasePool: pool });
  const testRunId = Date.now().toString();

  try {
    await database.query("BEGIN");

    const template = await cardTemplateService.createTemplate(
      createTemplateInput(`M8 Instance ${testRunId}`),
      { database },
    );
    const playerResult = await database.query(
      `
        INSERT INTO players (discord_user_id, username_snapshot)
        VALUES ($1, 'M8InstanceOwner')
        RETURNING player_id
      `,
      [`993${testRunId}`],
    );
    const playerId = playerResult.rows[0].player_id;

    const firstMint = await cardInstanceService.mintCard(
      {
        cardTemplateId: template.cardTemplateId,
        ownerPlayerId: playerId,
        cardLevel: 2,
        obtainedMethod: "ADMIN_GRANT",
        referenceType: "M8_TEST",
        referenceId: testRunId,
      },
      { database },
    );
    const secondMint = await cardInstanceService.mintCard(
      {
        cardTemplateId: template.cardTemplateId,
        ownerPlayerId: playerId,
        cardLevel: 5,
        obtainedMethod: "EVENT_REWARD",
      },
      { database },
    );

    assert.equal(firstMint.instance.serialNumber, "1");
    assert.equal(secondMint.instance.serialNumber, "2");
    assert.notEqual(firstMint.instance.publicCardId, secondMint.instance.publicCardId);
    assert.match(firstMint.instance.publicCardId, /^\d{9}$/);
    assert.equal(firstMint.instance.cardLevel, 2);
    assert.equal(firstMint.instance.status, "ACTIVE");
    assert.equal(firstMint.instance.ownerPlayerId, playerId);
    assert.equal(firstMint.ownershipHistory.fromPlayerId, null);
    assert.equal(firstMint.ownershipHistory.toPlayerId, playerId);
    assert.equal(firstMint.ownershipHistory.reason, "ADMIN_TRANSFER");
    assert.equal(secondMint.ownershipHistory.reason, "EVENT_REWARD");

    const collection = await collectionService.listOwnedCards(
      { playerId, rarityCode: "SUPERSTAR" },
      { database },
    );
    assert.equal(collection.total, "2");
    assert.equal(collection.cards.length, 2);
    assert.equal(collection.cards[0].cardInstanceId, firstMint.instance.cardInstanceId);
    assert.equal(collection.cards[0].collectionPosition, 1);
    assert.match(collection.cards[0].publicCardId, /^\d{9}$/);
    assert.equal(collection.cards[0].playerName, template.playerName);
    assert.equal(collection.cards[0].rarityCode, "SUPERSTAR");

    assert.equal(
      await collectionService.resolveOwnedCardReference(
        { playerId, cardReference: firstMint.instance.publicCardId },
        { database },
      ),
      firstMint.instance.cardInstanceId,
    );
    assert.equal(
      await collectionService.resolveOwnedCardReference(
        { playerId, cardReference: `!${firstMint.instance.publicCardId}` },
        { database },
      ),
      firstMint.instance.cardInstanceId,
    );
    assert.equal(
      await collectionService.resolveOwnedCardReference(
        { playerId, cardReference: "2" },
        { database },
      ),
      secondMint.instance.cardInstanceId,
    );

    const sorted = await collectionService.setSort(
      { playerId, sortBy: "NEWEST" },
      { database },
    );
    assert.equal(sorted.sortKey, "NEWEST");
    const newestFirst = await collectionService.listOwnedCards(
      { playerId },
      { database },
    );
    assert.equal(
      newestFirst.cards[0].cardInstanceId,
      secondMint.instance.cardInstanceId,
    );
    assert.equal(
      await collectionService.resolveOwnedCardReference(
        { playerId, cardReference: "1" },
        { database },
      ),
      secondMint.instance.cardInstanceId,
    );

    const counter = await cardInstanceService.getMintCounter(
      template.cardTemplateId,
      { database },
    );
    assert.deepEqual(
      {
        lastSerialNumber: counter.lastSerialNumber,
        totalMinted: counter.totalMinted,
        currentCirculation: counter.currentCirculation,
      },
      {
        lastSerialNumber: "2",
        totalMinted: "2",
        currentCirculation: "2",
      },
    );

    const storedInstance = await cardInstanceService.getInstance(
      firstMint.instance.cardInstanceId,
      { database },
    );
    assert.equal(storedInstance.serialNumber, "1");

    const history = await cardInstanceService.getOwnershipHistory(
      firstMint.instance.cardInstanceId,
      { database },
    );
    assert.equal(history.length, 1);
    assert.equal(history[0].referenceType, "M8_TEST");
    assert.equal(history[0].referenceId, testRunId);

    await assert.rejects(
      cardInstanceService.mintCard(
        {
          cardTemplateId: template.cardTemplateId,
          ownerPlayerId: playerId,
          cardLevel: 6,
          obtainedMethod: "PACK",
        },
        { database },
      ),
      /cardLevel must be an integer from 1 through 5/,
    );

    await assert.rejects(
      cardInstanceService.mintCard(
        {
          cardTemplateId: template.cardTemplateId,
          ownerPlayerId: "999999999999999999",
          cardLevel: 1,
          obtainedMethod: "PACK",
        },
        { database },
      ),
      (error) =>
        error instanceof CardError && error.code === "PLAYER_NOT_FOUND",
    );

    const unchangedCounter = await cardInstanceService.getMintCounter(
      template.cardTemplateId,
      { database },
    );
    assert.equal(unchangedCounter.totalMinted, "2");

    await database.query("SAVEPOINT invalid_instance_level");
    await assert.rejects(
      database.query(
        `
          INSERT INTO card_instances (
            card_template_id,
            public_card_id,
            owner_player_id,
            serial_number,
            card_level,
            obtained_method
          )
          VALUES ($1, 999999999, $2, 100, 6, 'ADMIN_GRANT')
        `,
        [template.cardTemplateId, playerId],
      ),
      (error) => error?.code === "23514",
    );
    await database.query("ROLLBACK TO SAVEPOINT invalid_instance_level");
  } finally {
    await database.query("ROLLBACK");
    const residualInstances = await database.query(
      `
        SELECT COUNT(*) AS instance_count
        FROM card_instances ci
        JOIN card_templates ct
          ON ct.card_template_id = ci.card_template_id
        WHERE ct.player_name LIKE $1
      `,
      [`%${testRunId}`],
    );
    assert.equal(residualInstances.rows[0].instance_count, "0");
    database.release();
    await pool.end();
  }
});
