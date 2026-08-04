import { getDatabaseConfig } from "../src/config/env.js";
import { createPostgresPool } from "../src/database/connection/postgres.js";

function parseArguments() {
  const [discordUserId, quantityText] = process.argv.slice(2);
  const quantity = Number(quantityText);

  if (!discordUserId || !/^\d+$/.test(discordUserId)) {
    throw new Error("discord_user_id must be a numeric string.");
  }
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new Error("quantity must be a positive integer.");
  }

  return { discordUserId, quantity };
}

async function grantItems() {
  const { discordUserId, quantity } = parseArguments();
  const pool = createPostgresPool({
    connectionString: getDatabaseConfig().databaseUrl,
  });

  try {
    const result = await pool.query(
      `
        INSERT INTO player_items (player_id, item_type, quantity)
        SELECT player_id, 'LEVEL_UP', $2
        FROM players
        WHERE discord_user_id = $1
        ON CONFLICT (player_id, item_type) DO UPDATE
          SET
            quantity = player_items.quantity + EXCLUDED.quantity,
            updated_at = CURRENT_TIMESTAMP
        RETURNING quantity
      `,
      [discordUserId, quantity],
    );

    if (result.rowCount !== 1) {
      throw new Error("Player was not found for the supplied Discord user ID.");
    }

    console.log(
      `Granted ${quantity} Level Up item(s). New quantity: ${result.rows[0].quantity}.`,
    );
  } finally {
    await pool.end();
  }
}

grantItems().catch((error) => {
  console.error(`Level Up item grant failed: ${error.message}`);
  process.exitCode = 1;
});
