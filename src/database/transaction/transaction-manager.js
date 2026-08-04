export async function withTransaction(pool, operation) {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    const result = await operation(client);

    await client.query("COMMIT");
    return result;
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        throw new AggregateError(
          [error, rollbackError],
          "Database transaction and rollback both failed.",
        );
      }
    }

    throw error;
  } finally {
    client.release();
  }
}
