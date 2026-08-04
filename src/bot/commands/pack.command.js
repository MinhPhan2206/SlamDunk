import { SlashCommandBuilder } from "discord.js";

import { PackError } from "../../modules/pack/index.js";
import {
  createPackCatalogMessage,
  createPackCooldownMessage,
  createPackOfferPayload,
  createPackSelectionPayload,
} from "../presenters/pack.presenter.js";

export const packCommand = Object.freeze({
  data: new SlashCommandBuilder()
    .setName("pack")
    .setDescription("Open your free SlamDunk card drop."),

  async execute(interaction, { services }) {
    await interaction.deferReply();

    const player = await services.player.getOrCreatePlayer({
      discordUserId: interaction.user.id,
      usernameSnapshot: interaction.user.username,
    });

    try {
      const result = await services.pack.createFreeDropOffer({
        playerId: player.playerId,
        interactionId: interaction.id,
      });
      const payload =
        result.session.status === "COMPLETED"
          ? createPackSelectionPayload(result)
          : createPackOfferPayload(result);

      await interaction.editReply(payload);
    } catch (error) {
      if (
        error instanceof PackError &&
        error.code === "FREE_DROP_COOLDOWN_ACTIVE"
      ) {
        await interaction.editReply({
          content: createPackCooldownMessage(error.details.availableAt),
          embeds: [],
          components: [],
        });
        return;
      }

      if (
        error instanceof PackError &&
        error.code === "PACK_CATALOG_TOO_SMALL"
      ) {
        await interaction.editReply({
          content: createPackCatalogMessage(error.details),
          embeds: [],
          components: [],
        });
        return;
      }

      throw error;
    }
  },
});
