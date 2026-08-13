import { readFile } from "node:fs/promises";

import { getDatabaseConfig } from "../src/config/env.js";
import { createPostgresPool } from "../src/database/connection/postgres.js";
import { withTransaction } from "../src/database/transaction/transaction-manager.js";
import { createCardTemplateService } from "../src/modules/card/index.js";

const catalogUrl = new URL("../data/card-templates.json", import.meta.url);
const traitCatalogUrl = new URL(
  "../data/card-template-traits.json",
  import.meta.url,
);

async function seedCatalog() {
  const [templates, traitProfiles] = await Promise.all([
    readFile(catalogUrl, "utf8").then(JSON.parse),
    readFile(traitCatalogUrl, "utf8").then(JSON.parse),
  ]);
  const pool = createPostgresPool({
    connectionString: getDatabaseConfig().databaseUrl,
  });
  const cardTemplateService = createCardTemplateService({ databasePool: pool });

  try {
    const result = await withTransaction(pool, async (database) => {
      let created = 0;
      let updated = 0;
      let traitAssignments = 0;

      for (const template of templates) {
        const existing = await database.query(
          `
          SELECT card_template_id
            FROM card_templates
            WHERE LOWER(player_name) = LOWER($1)
              AND rarity_id = (
                SELECT rarity_id FROM rarities WHERE rarity_code = $2
              )
          `,
          [template.playerName, template.rarityCode],
        );

        if (existing.rowCount > 0) {
          await cardTemplateService.updateTemplate(
            existing.rows[0].card_template_id,
            template,
            { database },
          );
          updated += 1;
          continue;
        }

        await cardTemplateService.createTemplate(template, { database });
        created += 1;
      }

      for (const profile of traitProfiles) {
        const templateResult = await database.query(
          `
            SELECT ct.card_template_id
            FROM card_templates ct
            JOIN rarities r ON r.rarity_id = ct.rarity_id
            WHERE LOWER(ct.player_name) = LOWER($1)
              AND r.rarity_code = $2
          `,
          [profile.playerName, profile.rarityCode],
        );
        if (templateResult.rowCount !== 1) {
          throw new Error(
            `Trait profile requires exactly one ${profile.rarityCode} ${profile.playerName} template.`,
          );
        }
        const cardTemplateId = templateResult.rows[0].card_template_id;
        await database.query(
          "DELETE FROM card_template_traits WHERE card_template_id = $1",
          [cardTemplateId],
        );

        for (const trait of profile.traits) {
          const assignmentResult = await database.query(
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
          if (assignmentResult.rowCount !== 1) {
            throw new Error(`Unknown Trait code: ${trait.traitCode}.`);
          }
          traitAssignments += 1;
        }
      }

      return { created, updated, total: templates.length, traitAssignments };
    });

    console.log(
      `Card catalog seed complete: ${result.created} created, ${result.updated} updated, ${result.total} total, ${result.traitAssignments} Trait assignments.`,
    );
  } finally {
    await pool.end();
  }
}

seedCatalog().catch((error) => {
  console.error(`Card catalog seed failed: ${error.message}`);
  process.exitCode = 1;
});
