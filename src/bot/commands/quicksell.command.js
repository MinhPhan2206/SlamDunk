import { SlashCommandBuilder } from "discord.js";

import { QuicksellError } from "../../modules/quicksell/index.js";
import { createQuicksellEmbed } from "../presenters/quicksell.presenter.js";

export const quicksellCommand = Object.freeze({
  data: new SlashCommandBuilder()
    .setName("quicksell")
    .setDescription("Destroy an unwanted card for Shards.")
    .addStringOption((option) =>
      option
        .setName("card_id")
        .setDescription("Card Instance ID shown in /collection.")
        .setRequired(true),
    ),

  async execute(interaction, { services }) {
    await interaction.deferReply();
    const player = await services.player.getOrCreatePlayer({
      discordUserId: interaction.user.id,
      usernameSnapshot: interaction.user.username,
    });

    try {
      const result = await services.quicksell.quicksell({
        playerId: player.playerId,
        cardInstanceId: interaction.options.getString("card_id", true),
      });
      await interaction.editReply({ embeds: [createQuicksellEmbed(result)] });
    } catch (error) {
      if (error instanceof QuicksellError) {
        await interaction.editReply({ content: error.message, embeds: [] });
        return;
      }
      throw error;
    }
  },
});
