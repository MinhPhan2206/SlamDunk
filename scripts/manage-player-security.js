import { getDatabaseConfig } from "../src/config/env.js";
import { createPostgresPool } from "../src/database/connection/postgres.js";
import { withTransaction } from "../src/database/transaction/transaction-manager.js";

const VALID_ACTIONS = new Set(["show", "freeze-trading", "disable", "clear"]);

function argumentsFromProcess() {
  const [action, discordUserId, minutesText = "60"] = process.argv.slice(2);
  if (!VALID_ACTIONS.has(action) || !/^\d{17,20}$/.test(discordUserId ?? "")) {
    throw new Error(
      "Usage: npm run admin:player-security -- <show|freeze-trading|disable|clear> <discord_user_id> [minutes]",
    );
  }
  const minutes = Number(minutesText);
  if (!Number.isSafeInteger(minutes) || minutes < 1 || minutes > 525_600) {
    throw new Error("minutes must be between 1 and 525600.");
  }
  return { action, discordUserId, minutes };
}

async function main() {
  const input = argumentsFromProcess();
  const pool = createPostgresPool({
    connectionString: getDatabaseConfig().databaseUrl,
  });
  try {
    const result = await withTransaction(pool, async (database) => {
      const playerResult = await database.query(
        "SELECT player_id FROM players WHERE discord_user_id = $1 FOR UPDATE",
        [input.discordUserId],
      );
      const playerId = playerResult.rows[0]?.player_id;
      if (!playerId) throw new Error("Player was not found.");
      if (input.action !== "show") {
        const tradingUntil = input.action === "freeze-trading"
          ? new Date(Date.now() + input.minutes * 60_000)
          : null;
        const disabledUntil = input.action === "disable"
          ? new Date(Date.now() + input.minutes * 60_000)
          : null;
        await database.query(
          `
            INSERT INTO player_security_profiles (
              player_id, trading_frozen_until, disabled_until
            ) VALUES ($1, $2, $3)
            ON CONFLICT (player_id) DO UPDATE SET
              trading_frozen_until = $2,
              disabled_until = $3,
              updated_at = CURRENT_TIMESTAMP
          `,
          [playerId, tradingUntil, disabledUntil],
        );
        await database.query(
          `
            INSERT INTO security_events (
              event_type, severity, discord_user_id, command_name, metadata
            ) VALUES ('ADMIN_PLAYER_RESTRICTION', 'HIGH', $1, 'admin-script', $2::JSONB)
          `,
          [
            input.discordUserId,
            JSON.stringify({ action: input.action, minutes: input.minutes }),
          ],
        );
      }
      const profile = await database.query(
        `
          SELECT risk_score, earning_frozen_until, trading_frozen_until,
            disabled_until, updated_at
          FROM player_security_profiles
          WHERE player_id = $1
        `,
        [playerId],
      );
      return profile.rows[0] ?? { risk_score: 0 };
    });
    console.log(`Security profile updated for ${input.discordUserId}.`);
    console.log(result);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`Player security operation failed: ${error.message}`);
  process.exitCode = 1;
});

