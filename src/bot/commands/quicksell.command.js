import { SlashCommandBuilder } from "discord.js";

import { CardError } from "../../modules/card/index.js";
import { QuicksellError } from "../../modules/quicksell/index.js";
import { createQuicksellPreviewPayload } from "../presenters/quicksell.presenter.js";

export const quicksellCommand = Object.freeze({
  data: new SlashCommandBuilder()
    .setName("quicksell")
    .setDescription("Destroy an unwanted card for Shards.")
    .addStringOption((option) =>
      option
        .setName("params")
        .setDescription("all, rarity, position, public Card ID, or collection number.")
        .setRequired(true),
    ),

  async execute(interaction, { services }) {
    await interaction.deferReply();
    const player = await services.player.getOrCreatePlayer({
      discordUserId: interaction.user.id,
      usernameSnapshot: interaction.user.username,
    });

    try {
      const params = interaction.options.getString("params", true);
      const cardInstanceId = /^!?\d+$/.test(params.trim())
        ? await services.collection.resolveOwnedCardReference({
            playerId: player.playerId,
            cardReference: params,
          })
        : null;
      const result = await services.quicksell.createPreview({
        playerId: player.playerId,
        params,
        interactionId: interaction.id,
        cardInstanceId,
      });
      await interaction.editReply(createQuicksellPreviewPayload(result));
    } catch (error) {
      if (error instanceof QuicksellError || error instanceof CardError) {
        await interaction.editReply({ content: error.message, embeds: [] });
        return;
      }
      throw error;
    }
  },
});
