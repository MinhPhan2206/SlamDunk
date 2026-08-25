import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const MIGRATION_LOCK_NAME = "slamdunk:schema-migrations";

export function calculateMigrationChecksum(sql) {
  return createHash("sha256").update(sql, "utf8").digest("hex");
}

async function loadMigrationFiles(migrationsDirectory) {
  const directoryEntries = await readdir(migrationsDirectory, {
    withFileTypes: true,
  });
  const migrationNames = directoryEntries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort();
  const migrations = [];
  for (const migrationName of migrationNames) {
    const sql = await readFile(
      path.join(migrationsDirectory, migrationName),
      "utf8",
    );
    migrations.push(Object.freeze({
      name: migrationName,
      sql,
      checksum: calculateMigrationChecksum(sql),
    }));
  }
  return migrations;
}

async function ensureMigrationTable(database) {
  await database.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      migration_name TEXT PRIMARY KEY,
      checksum TEXT,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await database.query(`
    ALTER TABLE schema_migrations
    ADD COLUMN IF NOT EXISTS checksum TEXT
  `);
}

async function getAppliedMigrations(database) {
  const result = await database.query(`
    SELECT migration_name, checksum
    FROM schema_migrations
    ORDER BY migration_name
  `);
  return result.rows;
}

export function validateMigrationState(appliedRows, migrations, {
  allowChecksumBaseline = false,
} = {}) {
  const available = new Map(migrations.map((migration) => [migration.name, migration]));
  const applied = new Map();
  for (const row of appliedRows) {
    const migration = available.get(row.migration_name);
    if (!migration) {
      throw new Error(
        `Applied migration is missing from the repository: ${row.migration_name}`,
      );
    }
    if (!row.checksum && !allowChecksumBaseline) {
      throw new Error(
        `Migration checksum is missing for ${row.migration_name}. Run migrations before startup.`,
      );
    }
    if (row.checksum && row.checksum !== migration.checksum) {
      throw new Error(
        `Applied migration checksum mismatch: ${row.migration_name}`,
      );
    }
    applied.set(row.migration_name, row.checksum);
  }
  let pendingSeen = false;
  for (const migration of migrations) {
    if (!applied.has(migration.name)) {
      pendingSeen = true;
    } else if (pendingSeen) {
      throw new Error(
        `Applied migrations are out of order at ${migration.name}.`,
      );
    }
  }
  return Object.freeze({
    applied,
    pending: migrations.filter((migration) => !applied.has(migration.name)),
  });
}

async function runTransaction(client, operation) {
  await client.query("BEGIN");
  try {
    const result = await operation();
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      throw new AggregateError(
        [error, rollbackError],
        "Migration and rollback both failed.",
      );
    }
    throw error;
  }
}

export async function runMigrations(pool, migrationsDirectory) {
  const migrations = await loadMigrationFiles(migrationsDirectory);
  const client = await pool.connect();
  let lockAcquired = false;
  try {
    await client.query(
      "SELECT pg_advisory_lock(hashtext($1))",
      [MIGRATION_LOCK_NAME],
    );
    lockAcquired = true;
    await ensureMigrationTable(client);

    const appliedRows = await getAppliedMigrations(client);
    const state = validateMigrationState(appliedRows, migrations, {
      allowChecksumBaseline: true,
    });
    for (const row of appliedRows) {
      if (row.checksum) continue;
      await client.query(
        `UPDATE schema_migrations
         SET checksum = $2
         WHERE migration_name = $1 AND checksum IS NULL`,
        [row.migration_name, state.applied.get(row.migration_name) ??
          migrations.find(({ name }) => name === row.migration_name).checksum],
      );
    }

    for (const migration of state.pending) {
      await runTransaction(client, async () => {
        await client.query(migration.sql);
        await client.query(
          `INSERT INTO schema_migrations (migration_name, checksum)
           VALUES ($1, $2)`,
          [migration.name, migration.checksum],
        );
      });
      console.log(`Applied migration: ${migration.name}`);
    }

    await client.query(
      "ALTER TABLE schema_migrations ALTER COLUMN checksum SET NOT NULL",
    );
    return Object.freeze({
      appliedCount: migrations.length,
      latestMigration: migrations.at(-1)?.name ?? null,
    });
  } finally {
    try {
      if (lockAcquired) {
        await client.query(
          "SELECT pg_advisory_unlock(hashtext($1))",
          [MIGRATION_LOCK_NAME],
        );
      }
    } finally {
      client.release();
    }
  }
}

export async function assertSchemaCurrent(pool, migrationsDirectory) {
  const migrations = await loadMigrationFiles(migrationsDirectory);
  let appliedRows;
  try {
    appliedRows = await getAppliedMigrations(pool);
  } catch (error) {
    throw new Error(
      "Database schema metadata is missing. Run npm run db:migrate.",
      { cause: error },
    );
  }
  const state = validateMigrationState(appliedRows, migrations);
  if (state.pending.length > 0) {
    throw new Error(
      `Database schema is outdated. Pending migration: ${state.pending[0].name}`,
    );
  }
  return Object.freeze({
    appliedCount: appliedRows.length,
    latestMigration: migrations.at(-1)?.name ?? null,
  });
}
