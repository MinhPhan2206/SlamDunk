import { getDatabaseConfig } from "../src/config/env.js";
import { createPostgresPool } from "../src/database/connection/postgres.js";
import { createSecurityService } from "../src/modules/security/index.js";

async function main() {
  const pool = createPostgresPool({
    connectionString: getDatabaseConfig().databaseUrl,
  });
  try {
    const security = createSecurityService({ databasePool: pool });
    const signals = await security.scanAbuseSignals();
    console.log(`Security scan recorded ${signals.length} new signal(s).`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  const detail = error.detail ? ` ${error.detail}` : "";
  console.error(`Security abuse scan failed: ${error.message}.${detail}`);
  process.exitCode = 1;
});
