import assert from "node:assert/strict";
import test from "node:test";

import { getTestDatabaseConfig } from "../src/config/env.js";
import { createPostgresPool } from "../src/database/connection/postgres.js";
import { securityRepository } from "../src/modules/security/security.repository.js";

test("aggregated security events persist with one batch query", async () => {
  const pool = createPostgresPool({
    connectionString: getTestDatabaseConfig().databaseUrl,
  });
  const database = await pool.connect();
  try {
    await database.query("BEGIN");
    const inserted = await securityRepository.createEvents(database, [
      {
        eventType: "RATE_LIMITED",
        severity: "WARNING",
        discordUserId: "rb07-user",
        guildId: "rb07-guild",
        channelId: "rb07-channel",
        commandName: "pack",
        metadata: { count: 80, aggregated: true },
      },
      {
        eventType: "BOT_BUSY",
        severity: "WARNING",
        discordUserId: "rb07-user",
        guildId: "rb07-guild",
        channelId: "rb07-channel",
        commandName: "battle",
        metadata: { count: 20, aggregated: true },
      },
    ]);
    assert.equal(inserted, 2);

    const stored = await database.query(
      `
        SELECT event_type, metadata
        FROM security_events
        WHERE discord_user_id = 'rb07-user'
        ORDER BY event_type
      `,
    );
    assert.deepEqual(
      stored.rows.map((row) => [row.event_type, row.metadata.count]),
      [["BOT_BUSY", 20], ["RATE_LIMITED", 80]],
    );
  } finally {
    await database.query("ROLLBACK");
    database.release();
    await pool.end();
  }
});
