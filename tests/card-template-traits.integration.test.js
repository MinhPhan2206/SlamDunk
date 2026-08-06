import assert from "node:assert/strict";
import test from "node:test";

import { getDatabaseConfig } from "../src/config/env.js";
import { createPostgresPool } from "../src/database/connection/postgres.js";
import { createCardTemplateService } from "../src/modules/card/index.js";
import { TraitError, createTraitService } from "../src/modules/trait/index.js";

function createTemplateInput(edition) {
  return {
    playerName: `M7 Test Player ${edition}`,
    primaryPosition: "PG",
    secondaryPosition: "SG",
    rarityCode: "ALL_STAR",
    overall: 91,
    finishing: 78,
    midRange: 88,
    threePoint: 95,
    playmaking: 92,
    perimeterDefense: 76,
    interiorDefense: 40,
    strength: 75,
    heightCm: 191,
    packable: true,
  };
}

test("Card Templates own fixed Trait assignments and tiers", async () => {
  const pool = createPostgresPool({
    connectionString: getDatabaseConfig().databaseUrl,
  });
  const database = await pool.connect();
  const cardTemplateService = createCardTemplateService({ databasePool: pool });
  const traitService = createTraitService({
    databasePool: pool,
    cardTemplateService,
  });
  const testRunId = Date.now().toString();

  try {
    await database.query("BEGIN");

    const baseTemplate = await cardTemplateService.createTemplate(
      createTemplateInput(`M7 Base ${testRunId}`),
      { database },
    );
    const playoffTemplate = await cardTemplateService.createTemplate(
      createTemplateInput(`M7 Playoffs ${testRunId}`),
      { database },
    );

    assert.notEqual(
      baseTemplate.cardTemplateId,
      playoffTemplate.cardTemplateId,
    );
    assert.equal(baseTemplate.rarityCode, "ALL_STAR");
    assert.equal(baseTemplate.overall, 91);
    assert.equal(baseTemplate.primaryPosition, "PG");
    assert.equal(baseTemplate.secondaryPosition, "SG");

    const sharedPlayerName = `M7 Cross Rarity ${testRunId}`;
    const sharedAllStar = await cardTemplateService.createTemplate(
      {
        ...createTemplateInput(`Cross All-Star ${testRunId}`),
        playerName: sharedPlayerName,
        rarityCode: "ALL_STAR",
      },
      { database },
    );
    const sharedCommon = await cardTemplateService.createTemplate(
      {
        ...createTemplateInput(`Cross Common ${testRunId}`),
        playerName: sharedPlayerName,
        rarityCode: "COMMON",
      },
      { database },
    );
    assert.notEqual(sharedAllStar.cardTemplateId, sharedCommon.cardTemplateId);

    await database.query("SAVEPOINT duplicate_player_rarity");
    await assert.rejects(
      cardTemplateService.createTemplate(
        {
          ...createTemplateInput(`Cross Duplicate ${testRunId}`),
          playerName: sharedPlayerName.toUpperCase(),
          rarityCode: "COMMON",
        },
        { database },
      ),
      (error) => error?.code === "23505",
    );
    await database.query("ROLLBACK TO SAVEPOINT duplicate_player_rarity");

    const rangeSpecialist = await traitService.createDefinition(
      {
        traitCode: `RANGE_SPECIALIST_${testRunId}`,
        traitName: "Range Specialist",
        traitType: "OFFENSE",
        description: "Reduces eligible long-range distance penalties.",
      },
      { database },
    );
    const floorGeneral = await traitService.createDefinition(
      {
        traitCode: `FLOOR_GENERAL_${testRunId}`,
        traitName: "Floor General",
        traitType: "PLAYMAKING",
        description: "Improves team decision-making while handling the ball.",
      },
      { database },
    );
    const inactiveTrait = await traitService.createDefinition(
      {
        traitCode: `INACTIVE_TRAIT_${testRunId}`,
        traitName: "Inactive Trait",
        traitType: "OFFENSE",
        description: "A retired Trait used to verify assignment rules.",
        active: false,
      },
      { database },
    );

    const firstAssignment = await traitService.assignTraitToTemplate(
      {
        cardTemplateId: baseTemplate.cardTemplateId,
        traitId: rangeSpecialist.traitId,
        traitTier: 3,
      },
      { database },
    );
    await traitService.assignTraitToTemplate(
      {
        cardTemplateId: baseTemplate.cardTemplateId,
        traitId: floorGeneral.traitId,
        traitTier: 2,
      },
      { database },
    );

    assert.equal(firstAssignment.traitTier, 3);
    assert.equal(firstAssignment.traitTierLabel, "III");

    const traits = await traitService.getTraitsForTemplate(
      baseTemplate.cardTemplateId,
      { database },
    );
    assert.equal(traits.length, 2);
    assert.equal(
      await traitService.getTotalTraitLevel(baseTemplate.cardTemplateId, {
        database,
      }),
      5,
    );

    await assert.rejects(
      traitService.assignTraitToTemplate(
        {
          cardTemplateId: baseTemplate.cardTemplateId,
          traitId: rangeSpecialist.traitId,
          traitTier: 1,
        },
        { database },
      ),
      (error) =>
        error instanceof TraitError && error.code === "TRAIT_ALREADY_ASSIGNED",
    );

    await assert.rejects(
      cardTemplateService.createTemplate(
        { ...createTemplateInput("Invalid OVR"), overall: 59 },
        { database },
      ),
      /overall must be an integer from 60 through 99/,
    );

    await assert.rejects(
      traitService.assignTraitToTemplate(
        {
          cardTemplateId: baseTemplate.cardTemplateId,
          traitId: floorGeneral.traitId,
          traitTier: 4,
        },
        { database },
      ),
      /traitTier must be 1, 2, or 3/,
    );

    await assert.rejects(
      traitService.assignTraitToTemplate(
        {
          cardTemplateId: baseTemplate.cardTemplateId,
          traitId: inactiveTrait.traitId,
          traitTier: 1,
        },
        { database },
      ),
      (error) =>
        error instanceof TraitError && error.code === "TRAIT_INACTIVE",
    );

    await database.query("SAVEPOINT invalid_trait_tier_check");
    await assert.rejects(
      database.query(
        `
          INSERT INTO card_template_traits (
            card_template_id,
            trait_id,
            trait_tier
          )
          VALUES ($1, $2, 4)
        `,
        [playoffTemplate.cardTemplateId, rangeSpecialist.traitId],
      ),
      (error) => error?.code === "23514",
    );
    await database.query("ROLLBACK TO SAVEPOINT invalid_trait_tier_check");
  } finally {
    await database.query("ROLLBACK");
    const residualTemplates = await database.query(
      `
        SELECT COUNT(*) AS template_count
        FROM card_templates
        WHERE player_name = 'M7 Test Player'
          AND player_name LIKE $1
      `,
      [`%${testRunId}`],
    );
    assert.equal(residualTemplates.rows[0].template_count, "0");
    database.release();
    await pool.end();
  }
});
