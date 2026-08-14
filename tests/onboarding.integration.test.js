import assert from "node:assert/strict";
import test from "node:test";

import { getDatabaseConfig } from "../src/config/env.js";
import { createPostgresPool } from "../src/database/connection/postgres.js";
import {
  createCardInstanceService,
  createCardTemplateService,
} from "../src/modules/card/index.js";
import { createLineupService } from "../src/modules/lineup/index.js";
import { createOnboardingService } from "../src/modules/onboarding/index.js";
import { createPlayerService } from "../src/modules/player/index.js";

test("onboarding grants one complete Base starter lineup exactly once", async () => {
  const pool = createPostgresPool({ connectionString: getDatabaseConfig().databaseUrl });
  const database = await pool.connect();
  const cardTemplateService = createCardTemplateService({ databasePool: pool });
  const playerService = createPlayerService({ databasePool: pool });
  const cardInstanceService = createCardInstanceService({
    databasePool: pool,
    cardTemplateService,
    playerService,
  });
  const lineupService = createLineupService({ databasePool: pool });
  const onboardingService = createOnboardingService({
    databasePool: pool,
    cardTemplateService,
    cardInstanceService,
    lineupService,
    randomIndex: () => 0,
  });

  try {
    await database.query("BEGIN");
    const playerResult = await database.query(
      `INSERT INTO players (discord_user_id, username_snapshot)
       VALUES ($1, 'Starter Test') RETURNING player_id`,
      [`977${Date.now()}`],
    );
    const playerId = playerResult.rows[0].player_id;
    const first = await onboardingService.grantStarterLineup({
      playerId,
      interactionId: `welcome-${Date.now()}`,
    }, { database });
    const second = await onboardingService.grantStarterLineup({
      playerId,
      interactionId: `welcome-replay-${Date.now()}`,
    }, { database });
    const lineup = await lineupService.getLineup(playerId, { database });
    const countResult = await database.query(
      "SELECT COUNT(*)::integer AS count FROM card_instances WHERE owner_player_id = $1",
      [playerId],
    );

    assert.equal(first.alreadyGranted, false);
    assert.deepEqual(first.cards.map((card) => card.slot), ["PG", "SG", "SF", "PF", "C"]);
    assert.ok(first.cards.every((card) => card.rarityName === "Base" && card.cardLevel === 1));
    assert.equal(second.alreadyGranted, true);
    assert.equal(countResult.rows[0].count, 5);
    assert.equal(lineup.complete, true);
  } finally {
    await database.query("ROLLBACK");
    database.release();
    await pool.end();
  }
});
