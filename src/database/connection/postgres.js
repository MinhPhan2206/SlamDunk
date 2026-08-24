import pg from "pg";

const { Pool } = pg;

export function createPostgresPool({
  connectionString,
  maximumConnections = 5,
  connectionTimeoutMilliseconds = 5_000,
  idleTimeoutMilliseconds = 30_000,
  statementTimeoutMilliseconds = 15_000,
}) {
  const pool = new Pool({
    connectionString,
    max: maximumConnections,
    connectionTimeoutMillis: connectionTimeoutMilliseconds,
    idleTimeoutMillis: idleTimeoutMilliseconds,
    statement_timeout: statementTimeoutMilliseconds,
    query_timeout: statementTimeoutMilliseconds,
  });

  pool.on("error", (error) => {
    const errorCode = typeof error?.code === "string" ? ` (${error.code})` : "";
    console.error(`Unexpected PostgreSQL pool error${errorCode}.`);
  });

  return pool;
}

export async function checkPostgresConnection(pool) {
  try {
    await pool.query("SELECT 1");
  } catch (error) {
    throw new Error("PostgreSQL connection check failed.", { cause: error });
  }
}
