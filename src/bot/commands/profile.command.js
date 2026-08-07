import { SlashCommandBuilder } from "discord.js";

import { createProfileEmbed } from "../presenters/profile.presenter.js";

export const profileCommand = Object.freeze({
  data: new SlashCommandBuilder()
    .setName("profile")
    .setDescription("View a SlamDunk player profile.")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("User whose profile you want to view."),
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
    const wallet = await services.economy.getWallet(player.playerId);

    if (!wallet) {
      throw new Error("Player wallet was not found.");
    }

    const embed = createProfileEmbed({
      player,
      wallet,
      displayName: targetUser.globalName ?? targetUser.username,
      thumbnailUrl: targetUser.displayAvatarURL?.({ extension: "png", size: 128 }),
    });
    await interaction.editReply({ embeds: [embed] });
  },
});
