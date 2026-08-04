import { readFile } from "node:fs/promises";

import { getDatabaseConfig } from "../src/config/env.js";
import { createPostgresPool } from "../src/database/connection/postgres.js";
import { withTransaction } from "../src/database/transaction/transaction-manager.js";
import { createCardTemplateService } from "../src/modules/card/index.js";

const catalogUrl = new URL("../data/card-templates.json", import.meta.url);

async function seedCatalog() {
  const templates = JSON.parse(await readFile(catalogUrl, "utf8"));
  const pool = createPostgresPool({
    connectionString: getDatabaseConfig().databaseUrl,
  });
  const cardTemplateService = createCardTemplateService({ databasePool: pool });

  try {
    const result = await withTransaction(pool, async (database) => {
      let created = 0;
      let skipped = 0;

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
          skipped += 1;
          continue;
        }

        await cardTemplateService.createTemplate(template, { database });
        created += 1;
      }

      return { created, skipped, total: templates.length };
    });

    console.log(
      `Card catalog seed complete: ${result.created} created, ${result.skipped} skipped, ${result.total} total.`,
    );
  } finally {
    await pool.end();
  }
}

seedCatalog().catch((error) => {
  console.error(`Card catalog seed failed: ${error.message}`);
  process.exitCode = 1;
});
