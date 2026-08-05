import { SlashCommandBuilder } from "discord.js";

import { createCollectionEmbed } from "../presenters/collection.presenter.js";

export const collectionCommand = Object.freeze({
  data: new SlashCommandBuilder()
    .setName("collection")
    .setDescription("View your SlamDunk card collection.")
    .addIntegerOption((option) =>
      option
        .setName("page")
        .setDescription("Collection page number.")
        .setMinValue(1),
    ),

  async execute(interaction, { services }) {
    await interaction.deferReply();

    const player = await services.player.getOrCreatePlayer({
      discordUserId: interaction.user.id,
      usernameSnapshot: interaction.user.username,
    });
    const collection = await services.collection.listOwnedCards({
      playerId: player.playerId,
      page: interaction.options.getInteger("page") ?? 1,
    });

    await interaction.editReply({
      embeds: [createCollectionEmbed(collection)],
    });
  },
});
