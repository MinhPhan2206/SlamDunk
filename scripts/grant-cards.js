import { randomUUID } from "node:crypto";

import { getDatabaseConfig } from "../src/config/env.js";
import { createPostgresPool } from "../src/database/connection/postgres.js";
import { withTransaction } from "../src/database/transaction/transaction-manager.js";
import {
  createCardInstanceService,
  createCardTemplateService,
} from "../src/modules/card/index.js";
import { createPlayerService } from "../src/modules/player/index.js";

function parseArguments() {
  const [discordUserId, rarityText, levelText, quantityText] = process.argv.slice(2);
  const rarityCode = rarityText?.trim().toUpperCase();
  const cardLevel = Number(levelText);
  const quantity = Number(quantityText);

  if (!discordUserId || !/^\d+$/.test(discordUserId)) {
    throw new Error("discord_user_id must be a numeric string.");
  }
  if (!rarityCode) throw new Error("rarity_code is required.");
  if (!Number.isSafeInteger(cardLevel) || cardLevel < 1 || cardLevel > 5) {
    throw new Error("card_level must be an integer from 1 through 5.");
  }
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 20) {
    throw new Error("quantity must be an integer from 1 through 20.");
  }

  return { discordUserId, rarityCode, cardLevel, quantity };
}

async function grantCards() {
  const input = parseArguments();
  const pool = createPostgresPool({
    connectionString: getDatabaseConfig().databaseUrl,
  });
  const playerService = createPlayerService({ databasePool: pool });
  const cardTemplateService = createCardTemplateService({ databasePool: pool });
  const cardInstanceService = createCardInstanceService({
    databasePool: pool,
    cardTemplateService,
    playerService,
  });

  try {
    const player = await playerService.getPlayer(input.discordUserId);
    if (!player) {
      throw new Error("Player was not found for the supplied Discord user ID.");
    }

    const templates = (await cardTemplateService.listPackableTemplates())
      .filter((template) => template.rarityCode === input.rarityCode)
      .slice(0, input.quantity);
    if (templates.length !== input.quantity) {
      throw new Error(
        `Only ${templates.length} active packable ${input.rarityCode} templates are available.`,
      );
    }

    const referenceId = randomUUID();
    const granted = await withTransaction(pool, async (database) => {
      const results = [];
      for (const template of templates) {
        const mint = await cardInstanceService.mintCard({
          cardTemplateId: template.cardTemplateId,
          ownerPlayerId: player.playerId,
          cardLevel: input.cardLevel,
          obtainedMethod: "ADMIN_GRANT",
          referenceType: "ADMIN_GRANT",
          referenceId,
        }, { database });
        results.push({ template, instance: mint.instance });
      }
      return results;
    });

    console.log(
      `Granted ${granted.length} ${input.rarityCode} Level ${input.cardLevel} cards ` +
      `to ${player.usernameSnapshot} (${input.discordUserId}).`,
    );
    for (const { template, instance } of granted) {
      console.log(`- ${template.playerName}: !${instance.publicCardId}`);
    }
  } finally {
    await pool.end();
  }
}

grantCards().catch((error) => {
  console.error(`Card grant failed: ${error.message}`);
  process.exitCode = 1;
});
