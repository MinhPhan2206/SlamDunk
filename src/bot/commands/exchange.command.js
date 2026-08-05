import { SlashCommandBuilder } from "discord.js";
import { createExchangeMenu } from "../presenters/exchange.presenter.js";

export const exchangeCommand = Object.freeze({
  data: new SlashCommandBuilder()
    .setName("exchange")
    .setDescription("Exchange resources for items.")
    .addStringOption((option) => option
      .setName("item").setDescription("Resource to exchange.").setRequired(true)
      .addChoices({ name: "Shard", value: "shard" })),
  async execute(interaction, { services }) {
    await interaction.deferReply();
    const player = await services.player.getOrCreatePlayer({
      discordUserId: interaction.user.id, usernameSnapshot: interaction.user.username,
    });
    const item = interaction.options.getString("item", true);
    const wallet = await services.economy.getBalance(player.playerId);
    await interaction.editReply(createExchangeMenu({
      playerId: player.playerId,
      shardBalance: wallet.shardBalance,
      offers: services.exchange.listOffers(item),
    }));
  },
});
