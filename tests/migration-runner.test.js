import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateMigrationChecksum,
  validateMigrationState,
} from "../src/database/migrations/migration-runner.js";

function migration(name, sql) {
  return Object.freeze({
    name,
    sql,
    checksum: calculateMigrationChecksum(sql),
  });
}

test("migration checksums are stable and detect edited applied files", () => {
  const original = migration("001_example.sql", "CREATE TABLE example (id BIGINT);");
  assert.equal(original.checksum.length, 64);
  assert.equal(
    original.checksum,
    calculateMigrationChecksum("CREATE TABLE example (id BIGINT);"),
  );

  const edited = migration("001_example.sql", "CREATE TABLE example (id TEXT);");
  assert.throws(
    () => validateMigrationState([
      { migration_name: original.name, checksum: original.checksum },
    ], [edited]),
    /checksum mismatch/,
  );
});

test("migration state detects missing, pending, and unbaselined migrations", () => {
  const first = migration("001_example.sql", "SELECT 1;");
  const second = migration("002_example.sql", "SELECT 2;");

  const state = validateMigrationState([
    { migration_name: first.name, checksum: first.checksum },
  ], [first, second]);
  assert.deepEqual(state.pending.map(({ name }) => name), [second.name]);

  assert.throws(
    () => validateMigrationState([
      { migration_name: "000_removed.sql", checksum: "a".repeat(64) },
    ], [first]),
    /missing from the repository/,
  );
  assert.throws(
    () => validateMigrationState([
      { migration_name: first.name, checksum: null },
    ], [first]),
    /checksum is missing/,
  );
  assert.doesNotThrow(() => validateMigrationState([
    { migration_name: first.name, checksum: null },
  ], [first], { allowChecksumBaseline: true }));

  assert.throws(
    () => validateMigrationState([
      { migration_name: second.name, checksum: second.checksum },
    ], [first, second]),
    /out of order/,
  );
});
