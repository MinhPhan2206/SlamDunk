import pg from "pg";

const { Pool } = pg;

export function createPostgresPool({ connectionString }) {
  const pool = new Pool({ connectionString });

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
