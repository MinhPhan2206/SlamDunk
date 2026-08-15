import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { getDatabaseConfig } from "../src/config/env.js";
import { createPostgresPool } from "../src/database/connection/postgres.js";
import { withTransaction } from "../src/database/transaction/transaction-manager.js";
import { createCardTemplateService } from "../src/modules/card/index.js";
import {
  createEconomyService,
  EconomyCurrency,
} from "../src/modules/economy/index.js";

const RESET_CODE = "official-card-catalog-2026-08-15";
const COMPENSATION_GOLD = 50_000n;
const EXPECTED_TEMPLATE_COUNT = 277;
const REQUIRED_ARGUMENT = `--confirm=${RESET_CODE}`;
const catalogUrl = new URL("../data/card-templates.json", import.meta.url);
const traitCatalogUrl = new URL(
  "../data/card-template-traits.json",
  import.meta.url,
);
const backupDirectoryUrl = new URL("../backups/", import.meta.url);

const RESET_TABLES = Object.freeze([
  "quicksell_session_cards",
  "quicksell_sessions",
  "lineup_slots",
  "lineups",
  "market_listings",
  "trade_cards",
  "trade_participants",
  "trades",
  "drop_session_candidates",
  "drop_sessions",
  "pack_opening_cards",
  "pack_openings",
  "upgrade_item_usages",
  "fusion_sources",
  "fusions",
  "card_ownership_history",
  "match_players",
  "match_teams",
  "matches",
  "card_instances",
  "card_mint_counters",
  "card_template_traits",
  "card_templates",
]);

const BACKUP_TABLES = Object.freeze([
  ...RESET_TABLES,
  "wallets",
]);

function catalogKey({ playerName, rarityCode }) {
  return `${rarityCode}:${playerName.trim().toLocaleLowerCase("en-US")}`;
}

function validateCatalog(templates, traitProfiles) {
  if (!Array.isArray(templates) || templates.length !== EXPECTED_TEMPLATE_COUNT) {
    throw new Error(
      `Official catalog must contain exactly ${EXPECTED_TEMPLATE_COUNT} templates.`,
    );
  }
  if (!Array.isArray(traitProfiles) || traitProfiles.length !== templates.length) {
    throw new Error("Every official Card Template must have one Trait profile.");
  }

  const templateKeys = new Set(templates.map(catalogKey));
  const profileKeys = new Set(traitProfiles.map(catalogKey));
  if (templateKeys.size !== templates.length) {
    throw new Error("Official catalog contains duplicate player/rarity templates.");
  }
  if (profileKeys.size !== traitProfiles.length) {
    throw new Error("Official catalog contains duplicate Trait profiles.");
  }
  if (
    templateKeys.size !== profileKeys.size ||
    [...templateKeys].some((key) => !profileKeys.has(key))
  ) {
    throw new Error("Card Template and Trait profile catalogs do not match.");
  }

  for (const profile of traitProfiles) {
    if (!Array.isArray(profile.traits)) {
      throw new Error(`Traits must be an array for ${profile.playerName}.`);
    }
    const traitCodes = new Set();
    for (const trait of profile.traits) {
      if (
        typeof trait.traitCode !== "string" ||
        !Number.isInteger(trait.traitTier) ||
        trait.traitTier < 1 ||
        trait.traitTier > 5
      ) {
        throw new Error(`Invalid Trait assignment for ${profile.playerName}.`);
      }
      if (traitCodes.has(trait.traitCode)) {
        throw new Error(`Duplicate Trait ${trait.traitCode} for ${profile.playerName}.`);
      }
      traitCodes.add(trait.traitCode);
    }
  }
}

async function resetWasApplied(database) {
  const result = await database.query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM economy_transactions
        WHERE reference_type = 'CARD_CATALOG_RESET'
          AND reference_id = $1
      ) AS applied
    `,
    [RESET_CODE],
  );
  return result.rows[0].applied;
}

function backupFileName() {
  return `card-catalog-reset-${new Date().toISOString().replaceAll(":", "-")}.json`;
}

async function createBackup(databasePool) {
  const tables = {};
  for (const tableName of BACKUP_TABLES) {
    const result = await databasePool.query(`SELECT * FROM ${tableName}`);
    tables[tableName] = result.rows;
  }

  await mkdir(backupDirectoryUrl, { recursive: true });
  const fileUrl = new URL(backupFileName(), backupDirectoryUrl);
  await writeFile(
    fileUrl,
    `${JSON.stringify({ resetCode: RESET_CODE, createdAt: new Date(), tables })}\n`,
    "utf8",
  );
  return path.resolve(fileUrl.pathname.slice(1));
}

async function replaceCatalog() {
  if (!process.argv.includes(REQUIRED_ARGUMENT)) {
    throw new Error(`Destructive reset requires ${REQUIRED_ARGUMENT}.`);
  }

  const [templates, traitProfiles] = await Promise.all([
    readFile(catalogUrl, "utf8").then(JSON.parse),
    readFile(traitCatalogUrl, "utf8").then(JSON.parse),
  ]);
  validateCatalog(templates, traitProfiles);

  const pool = createPostgresPool({
    connectionString: getDatabaseConfig().databaseUrl,
  });
  const cardTemplateService = createCardTemplateService({ databasePool: pool });
  const economyService = createEconomyService({ databasePool: pool });

  try {
    if (await resetWasApplied(pool)) {
      throw new Error(`Catalog reset ${RESET_CODE} was already applied.`);
    }

    const backupPath = await createBackup(pool);
    const result = await withTransaction(pool, async (database) => {
      await database.query("SET LOCAL lock_timeout = '15s'");
      await database.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        RESET_CODE,
      ]);
      await database.query(
        "LOCK TABLE players, wallets IN SHARE ROW EXCLUSIVE MODE",
      );
      await database.query(
        `LOCK TABLE ${RESET_TABLES.join(", ")} IN ACCESS EXCLUSIVE MODE`,
      );

      if (await resetWasApplied(database)) {
        throw new Error(`Catalog reset ${RESET_CODE} was already applied.`);
      }

      const playersResult = await database.query(
        "SELECT player_id FROM players ORDER BY player_id",
      );
      if (playersResult.rowCount === 0) {
        throw new Error("Catalog reset requires at least one existing player.");
      }

      for (const tableName of RESET_TABLES) {
        await database.query(`DELETE FROM ${tableName}`);
      }

      const templateIds = new Map();
      for (const template of templates) {
        const created = await cardTemplateService.createTemplate(template, {
          database,
        });
        templateIds.set(catalogKey(template), created.cardTemplateId);
      }

      let traitAssignments = 0;
      for (const profile of traitProfiles) {
        const cardTemplateId = templateIds.get(catalogKey(profile));
        for (const trait of profile.traits) {
          const assignment = await database.query(
            `
              INSERT INTO card_template_traits (
                card_template_id,
                trait_id,
                trait_tier
              )
              SELECT $1, trait_id, $3
              FROM trait_definitions
              WHERE trait_code = $2
              RETURNING trait_id
            `,
            [cardTemplateId, trait.traitCode, trait.traitTier],
          );
          if (assignment.rowCount !== 1) {
            throw new Error(`Unknown Trait code: ${trait.traitCode}.`);
          }
          traitAssignments += 1;
        }
      }

      for (const { player_id: playerId } of playersResult.rows) {
        await economyService.credit(
          {
            playerId,
            currency: EconomyCurrency.GOLD,
            amount: COMPENSATION_GOLD,
            transactionType: "CARD_CATALOG_RESET_COMPENSATION",
            referenceType: "CARD_CATALOG_RESET",
            referenceId: RESET_CODE,
            idempotencyKey: `${RESET_CODE}:player:${playerId}`,
          },
          { database },
        );
      }

      return {
        backupPath,
        templates: templates.length,
        traitAssignments,
        compensatedPlayers: playersResult.rowCount,
        compensationPerPlayer: COMPENSATION_GOLD.toString(),
      };
    });

    console.log(
      `Official Card catalog installed: ${result.templates} templates, ${result.traitAssignments} Trait assignments.`,
    );
    console.log(
      `Compensated ${result.compensatedPlayers} players with ${result.compensationPerPlayer} Gold each.`,
    );
    console.log(`Backup: ${result.backupPath}`);
  } finally {
    await pool.end();
  }
}

replaceCatalog().catch((error) => {
  console.error(`Official Card catalog replacement failed: ${error.message}`);
  process.exitCode = 1;
});
