import { SlashCommandBuilder } from "discord.js";
import { TradeError } from "../../modules/trade/index.js";
import { createTradePayload } from "../presenters/trade.presenter.js";

export const tradeCommand = Object.freeze({
  data: new SlashCommandBuilder()
    .setName("trade")
    .setDescription("Start an interactive Direct Trade.")
    .addUserOption((option) => option
      .setName("user").setDescription("The other trade participant.").setRequired(true)),
  async execute(interaction, { services }) {
    await interaction.deferReply();
    const invitedUser = interaction.options.getUser("user", true);
    try {
      if (invitedUser.bot || invitedUser.id === interaction.user.id) {
        throw new TradeError("TRADE_INVALID_USER", "Choose another non-bot Discord user.");
      }
      const [initiator, invited] = await Promise.all([
        services.player.getOrCreatePlayer({ discordUserId: interaction.user.id, usernameSnapshot: interaction.user.username }),
        services.player.getOrCreatePlayer({ discordUserId: invitedUser.id, usernameSnapshot: invitedUser.username }),
      ]);
      const result = await services.trade.createTrade({ initiatorPlayerId: initiator.playerId, invitedPlayerId: invited.playerId });
      await interaction.editReply(createTradePayload(result));
      const delay = Math.max(0, result.trade.expiresAt.getTime() - Date.now());
      const timer = setTimeout(async () => {
        try {
          const expired = await services.trade.expireTrade({ tradeId: result.trade.tradeId });
          if (expired) await interaction.editReply(createTradePayload(expired));
        } catch (error) {
          console.error(`Trade timeout failed: ${error.message}`);
        }
      }, delay);
      timer.unref();
    } catch (error) {
      if (error instanceof TradeError) {
        await interaction.editReply({ content: error.message, embeds: [], components: [] });
        return;
      }
      throw error;
    }
  },
});
