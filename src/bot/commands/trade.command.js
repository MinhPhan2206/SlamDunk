import { SlashCommandBuilder } from "discord.js";

import { TradeError } from "../../modules/trade/index.js";
import { createTradeEmbed } from "../presenters/trade.presenter.js";

function tradeIdOption(option) {
  return option
    .setName("trade_id")
    .setDescription("Direct Trade ID.")
    .setRequired(true);
}

function withTradeId(subcommand) {
  return subcommand.addStringOption(tradeIdOption);
}

export const tradeCommand = Object.freeze({
  data: new SlashCommandBuilder()
    .setName("trade")
    .setDescription("Create and manage a Direct Trade.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("create")
        .setDescription("Create a Direct Trade with another user.")
        .addUserOption((option) =>
          option
            .setName("user")
            .setDescription("The other trade participant.")
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      withTradeId(
        subcommand.setName("view").setDescription("View a Direct Trade."),
      ),
    )
    .addSubcommand((subcommand) =>
      withTradeId(
        subcommand
          .setName("add-card")
          .setDescription("Add one owned card to your offer."),
      ).addStringOption((option) =>
        option
          .setName("card_id")
          .setDescription("Card Instance ID shown in /collection.")
          .setRequired(true),
      ),
    )
    .addSubcommand((subcommand) =>
      withTradeId(
        subcommand
          .setName("remove-card")
          .setDescription("Remove one card from your offer."),
      ).addStringOption((option) =>
        option
          .setName("card_id")
          .setDescription("Card Instance ID to remove.")
          .setRequired(true),
      ),
    )
    .addSubcommand((subcommand) =>
      withTradeId(
        subcommand
          .setName("set-gold")
          .setDescription("Set the Gold included in your offer."),
      ).addIntegerOption((option) =>
        option
          .setName("amount")
          .setDescription("Gold offered; use 0 to remove the offer.")
          .setMinValue(0)
          .setRequired(true),
      ),
    )
    .addSubcommand((subcommand) =>
      withTradeId(
        subcommand
          .setName("confirm")
          .setDescription("Confirm the current final offer."),
      ),
    )
    .addSubcommand((subcommand) =>
      withTradeId(
        subcommand.setName("cancel").setDescription("Cancel a Direct Trade."),
      ),
    ),

  async execute(interaction, { services }) {
    await interaction.deferReply();
    const player = await services.player.getOrCreatePlayer({
      discordUserId: interaction.user.id,
      usernameSnapshot: interaction.user.username,
    });
    const subcommand = interaction.options.getSubcommand();

    try {
      let result;
      let title = "Direct Trade";
      if (subcommand === "create") {
        const invitedUser = interaction.options.getUser("user", true);
        if (invitedUser.bot) {
          throw new TradeError(
            "TRADE_BOT_USER",
            "A Discord bot cannot participate in Direct Trade.",
          );
        }
        const invitedPlayer = await services.player.getOrCreatePlayer({
          discordUserId: invitedUser.id,
          usernameSnapshot: invitedUser.username,
        });
        result = await services.trade.createTrade({
          initiatorPlayerId: player.playerId,
          invitedPlayerId: invitedPlayer.playerId,
        });
        title = "Direct Trade Created";
      } else {
        const input = {
          tradeId: interaction.options.getString("trade_id", true),
          playerId: player.playerId,
        };
        if (subcommand === "add-card") {
          result = await services.trade.addCard({
            ...input,
            cardInstanceId: interaction.options.getString("card_id", true),
          });
          title = "Card Added";
        } else if (subcommand === "remove-card") {
          result = await services.trade.removeCard({
            ...input,
            cardInstanceId: interaction.options.getString("card_id", true),
          });
          title = "Card Removed";
        } else if (subcommand === "set-gold") {
          result = await services.trade.setGoldOffer({
            ...input,
            goldOffered: interaction.options.getInteger("amount", true),
          });
          title = "Gold Offer Updated";
        } else if (subcommand === "confirm") {
          result = await services.trade.confirmTrade(input);
          title = result.completed ? "Direct Trade Completed" : "Trade Confirmed";
        } else if (subcommand === "cancel") {
          result = await services.trade.cancelTrade(input);
          title = "Direct Trade Cancelled";
        } else {
          result = await services.trade.getTrade(input);
        }
      }

      await interaction.editReply({ embeds: [createTradeEmbed(result, title)] });
    } catch (error) {
      if (error instanceof TradeError) {
        await interaction.editReply({ content: error.message, embeds: [] });
        return;
      }
      throw error;
    }
  },
});
