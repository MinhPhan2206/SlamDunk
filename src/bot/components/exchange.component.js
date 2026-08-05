import { ExchangeError } from "../../modules/exchange/index.js";
import { createExchangeMenu, createExchangeResult } from "../presenters/exchange.presenter.js";

export const exchangeComponent = Object.freeze({
  namespace: "exchange",
  async execute(interaction, { services }) {
    const [, action, ownerPlayerId, value] = interaction.customId.split(":");
    const player = await services.player.getOrCreatePlayer({
      discordUserId: interaction.user.id, usernameSnapshot: interaction.user.username,
    });
    if (player.playerId !== ownerPlayerId) {
      await interaction.reply({ content: "This Exchange menu belongs to another Player.", ephemeral: true });
      return;
    }
    if (action === "cancel") {
      await interaction.update({ content: "Exchange cancelled.", embeds: [], components: [] });
      return;
    }
    if (action === "select") {
      const wallet = await services.economy.getBalance(player.playerId);
      await interaction.update(createExchangeMenu({
        playerId: player.playerId,
        shardBalance: wallet.shardBalance,
        offers: services.exchange.listOffers(value),
        selected: interaction.values[0] === "level_up",
      }));
      return;
    }
    await interaction.deferUpdate();
    try {
      const result = await services.exchange.exchange({
        playerId: player.playerId, offerCode: value, interactionId: interaction.id,
      });
      await interaction.editReply(createExchangeResult(result));
    } catch (error) {
      if (error instanceof ExchangeError) {
        await interaction.editReply({ content: error.message, embeds: [], components: [] });
        return;
      }
      throw error;
    }
  },
});
