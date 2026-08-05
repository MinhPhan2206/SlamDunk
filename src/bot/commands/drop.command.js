import { SlashCommandBuilder } from "discord.js";

import { DropError } from "../../modules/drop/index.js";
import {
  createDropCatalogMessage,
  createDropCooldownMessage,
  createDropOfferPayload,
  createDropSelectionPayload,
} from "../presenters/drop.presenter.js";

export const dropCommand = Object.freeze({
  data: new SlashCommandBuilder()
    .setName("drop")
    .setDescription("Open your free SlamDunk card drop."),

  async execute(interaction, { services }) {
    await interaction.deferReply();

    const player = await services.player.getOrCreatePlayer({
      discordUserId: interaction.user.id,
      usernameSnapshot: interaction.user.username,
    });

    try {
      const result = await services.drop.createOffer({
        playerId: player.playerId,
        interactionId: interaction.id,
      });
      const payload =
        result.session.status === "COMPLETED"
          ? createDropSelectionPayload(result)
          : createDropOfferPayload(result);

      await interaction.editReply(payload);

      if (result.session.status === "OPEN") {
        const delay = Math.max(
          0,
          result.session.selectionExpiresAt.getTime() - Date.now(),
        );
        const timer = setTimeout(async () => {
          try {
            const completed = await services.drop.confirmSelection({
              playerId: player.playerId,
              dropSessionId: result.session.dropSessionId,
              candidatePosition: 1,
            });
            await interaction.editReply(createDropSelectionPayload(completed));
          } catch (error) {
            if (!(error instanceof DropError)) {
              console.error(`Drop timeout completion failed: ${error.message}`);
            }
          }
        }, delay);
        timer.unref();
      }
    } catch (error) {
      if (
        error instanceof DropError &&
        error.code === "FREE_DROP_COOLDOWN_ACTIVE"
      ) {
        await interaction.editReply({
          content: createDropCooldownMessage(error.details.availableAt),
          embeds: [],
          components: [],
        });
        return;
      }

      if (
        error instanceof DropError &&
        error.code === "DROP_CATALOG_TOO_SMALL"
      ) {
        await interaction.editReply({
          content: createDropCatalogMessage(error.details),
          embeds: [],
          components: [],
        });
        return;
      }

      throw error;
    }
  },
});
