import { SlashCommandBuilder } from "discord.js";

import { createBagEmbed } from "../presenters/bag.presenter.js";

export const bagCommand = Object.freeze({
  data: new SlashCommandBuilder()
    .setName("bag")
    .setDescription("View your Shards and items."),

  async execute(interaction, { services }) {
    await interaction.deferReply();
    const player = await services.player.getOrCreatePlayer({
      discordUserId: interaction.user.id,
      usernameSnapshot: interaction.user.username,
    });
    const [wallet, items] = await Promise.all([
      services.economy.getBalance(player.playerId),
      services.inventory.listItems(player.playerId),
    ]);
    await interaction.editReply({
      embeds: [createBagEmbed({
        shardBalance: wallet.shardBalance,
        items,
        displayName: interaction.user.globalName ?? interaction.user.username,
        thumbnailUrl: interaction.user.displayAvatarURL?.({ extension: "png", size: 128 }),
      })],
    });
  },
});
