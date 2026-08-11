import { SlashCommandBuilder } from "discord.js";

import { createWalletEmbed } from "../presenters/wallet.presenter.js";

export const walletCommand = Object.freeze({
  data: new SlashCommandBuilder()
    .setName("wallet")
    .setDescription("View your current Gold balance."),

  async execute(interaction, { services }) {
    await interaction.deferReply();
    const player = await services.player.getOrCreatePlayer({
      discordUserId: interaction.user.id,
      usernameSnapshot: interaction.user.username,
    });
    const wallet = await services.economy.getBalance(player.playerId);
    await interaction.editReply({
      embeds: [createWalletEmbed({
        wallet,
        displayName: interaction.user.globalName ?? interaction.user.username,
        thumbnailUrl: interaction.user.displayAvatarURL?.({ extension: "png", size: 128 }),
      })],
    });
  },
});
