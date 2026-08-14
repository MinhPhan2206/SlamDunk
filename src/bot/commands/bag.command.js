import { SlashCommandBuilder } from "discord.js";

import { createBagEmbed } from "../presenters/bag.presenter.js";

export const bagCommand = Object.freeze({
  data: new SlashCommandBuilder()
    .setName("bag")
    .setDescription("View a Player's Shards and items.")
    .addUserOption((option) => option
      .setName("user")
      .setDescription("User whose Bag you want to view.")),

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
    const [wallet, items] = await Promise.all([
      services.economy.getBalance(player.playerId),
      services.inventory.listItems(player.playerId),
    ]);
    await interaction.editReply({
      embeds: [createBagEmbed({
        shardBalance: wallet.shardBalance,
        items,
        displayName: targetUser.globalName ?? targetUser.username,
        thumbnailUrl: targetUser.displayAvatarURL?.({ extension: "png", size: 128 }),
      })],
    });
  },
});
