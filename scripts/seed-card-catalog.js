import { readFile } from "node:fs/promises";

import { getDatabaseConfig } from "../src/config/env.js";
import { createPostgresPool } from "../src/database/connection/postgres.js";
import { withTransaction } from "../src/database/transaction/transaction-manager.js";
import { createCardTemplateService } from "../src/modules/card/index.js";

const catalogUrls = [
  new URL("../data/card-templates.json", import.meta.url),
  new URL("../data/card-templates-2026.json", import.meta.url),
];

async function seedCatalog() {
  const catalogs = await Promise.all(
    catalogUrls.map(async (catalogUrl) => JSON.parse(await readFile(catalogUrl, "utf8"))),
  );
  const templates = catalogs.flat();
  const pool = createPostgresPool({
    connectionString: getDatabaseConfig().databaseUrl,
  });
  const cardTemplateService = createCardTemplateService({ databasePool: pool });

  try {
    const result = await withTransaction(pool, async (database) => {
      let created = 0;
      let updated = 0;

      for (const template of templates) {
        const existing = await database.query(
          `
          SELECT card_template_id
            FROM card_templates
            WHERE player_name = $1
              AND edition = $2
              AND season IS NOT DISTINCT FROM $3
          `,
          [template.playerName, template.edition, template.season],
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

      return { created, updated, total: templates.length };
    });

    console.log(
      `Card catalog seed complete: ${result.created} created, ${result.updated} updated, ${result.total} total.`,
    );
  } finally {
    await pool.end();
  }
}

seedCatalog().catch((error) => {
  console.error(`Card catalog seed failed: ${error.message}`);
  process.exitCode = 1;
});
