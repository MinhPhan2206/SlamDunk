import { SlashCommandBuilder } from "discord.js";

import { createCollectionPayload } from "../presenters/collection.presenter.js";

export const collectionCommand = Object.freeze({
  data: new SlashCommandBuilder()
    .setName("collection")
    .setDescription("View your SlamDunk card collection.")
    .addIntegerOption((option) =>
      option
        .setName("page")
        .setDescription("Collection page number.")
        .setMinValue(1),
    )
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("User whose collection you want to view."),
    ),

  async execute(interaction, { services }) {
    await interaction.deferReply();

    const targetUser = interaction.options.getUser("user") ?? interaction.user;
    const viewingSelf = targetUser.id === interaction.user.id;
    const player = viewingSelf
      ? await services.player.getOrCreatePlayer({
        discordUserId: interaction.user.id,
        usernameSnapshot: interaction.user.username,
      })
      : await services.player.getPlayer(targetUser.id);
    if (!player) {
      await interaction.editReply({
        content: `${targetUser.globalName ?? targetUser.username} does not have a SlamDunk profile yet.`,
      });
      return;
    }
    const collection = await services.collection.listOwnedCards({
      playerId: player.playerId,
      page: interaction.options.getInteger("page") ?? 1,
    });

    await interaction.editReply(
      createCollectionPayload(collection, {
        discordUserId: interaction.user.id,
        playerId: player.playerId,
        title: viewingSelf
          ? "Your Collection"
          : `${targetUser.globalName ?? targetUser.username}'s Collection`,
      }),
    );
  },
});
