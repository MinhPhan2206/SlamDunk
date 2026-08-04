import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { withTransaction } from "../transaction/transaction-manager.js";

async function ensureMigrationTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      migration_name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function getAppliedMigrations(pool) {
  const result = await pool.query(
    "SELECT migration_name FROM schema_migrations ORDER BY migration_name",
  );

  return new Set(result.rows.map((row) => row.migration_name));
}

export async function runMigrations(pool, migrationsDirectory) {
  await ensureMigrationTable(pool);

  const directoryEntries = await readdir(migrationsDirectory, {
    withFileTypes: true,
  });
  const migrationNames = directoryEntries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort();
  const appliedMigrations = await getAppliedMigrations(pool);

  for (const migrationName of migrationNames) {
    if (appliedMigrations.has(migrationName)) {
      continue;
    }

    const sql = await readFile(
      path.join(migrationsDirectory, migrationName),
      "utf8",
    );

    await withTransaction(pool, async (database) => {
      await database.query(sql);
      await database.query(
        "INSERT INTO schema_migrations (migration_name) VALUES ($1)",
        [migrationName],
      );
    });

    console.log(`Applied migration: ${migrationName}`);
  }
}
