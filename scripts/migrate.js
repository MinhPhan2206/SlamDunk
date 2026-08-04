import { fileURLToPath } from "node:url";

import { getDatabaseConfig } from "../src/config/env.js";
import { createPostgresPool } from "../src/database/connection/postgres.js";
import { runMigrations } from "../src/database/migrations/migration-runner.js";

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

async function migrate() {
  const config = getDatabaseConfig();
  const pool = createPostgresPool({ connectionString: config.databaseUrl });
  const migrationsDirectory = fileURLToPath(
    new URL("../migrations/", import.meta.url),
  );

  try {
    await runMigrations(pool, migrationsDirectory);
    console.log("Database migrations are up to date.");
  } finally {
    await pool.end();
  }
}

migrate().catch((error) => {
  console.error(`Database migration failed: ${getErrorMessage(error)}`);
  process.exitCode = 1;
});
