import { SlashCommandBuilder } from "discord.js";

import { createProfileEmbed } from "../presenters/profile.presenter.js";

export const profileCommand = Object.freeze({
  data: new SlashCommandBuilder()
    .setName("profile")
    .setDescription("View your SlamDunk player profile."),

  async execute(interaction, { services }) {
    await interaction.deferReply();

    const player = await services.player.getOrCreatePlayer({
      discordUserId: interaction.user.id,
      usernameSnapshot: interaction.user.username,
    });
    const wallet = await services.economy.getWallet(player.playerId);

    if (!wallet) {
      throw new Error("Player wallet was not found.");
    }

    const embed = createProfileEmbed({ player, wallet });
    await interaction.editReply({ embeds: [embed] });
  },
});
