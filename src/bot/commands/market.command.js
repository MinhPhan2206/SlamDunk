import { SlashCommandBuilder } from "discord.js";

import { CardError } from "../../modules/card/index.js";
import { MarketError } from "../../modules/market/index.js";
import {
  createMarketBrowseEmbed,
  createMarketCancellationEmbed,
  createMarketListingEmbed,
  createMarketPurchaseEmbed,
} from "../presenters/market.presenter.js";

function listingOption(option) {
  return option
    .setName("listing_id")
    .setDescription("Market Listing ID.")
    .setRequired(true);
}

export const marketCommand = Object.freeze({
  data: new SlashCommandBuilder()
    .setName("market")
    .setDescription("Browse and use the SlamDunk card Market.")
    .addSubcommand((subcommand) =>
      subcommand.setName("browse").setDescription("View active listings."),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("sell")
        .setDescription("List one of your cards for a fixed Gold price.")
        .addStringOption((option) =>
          option
            .setName("card_id")
            .setDescription("Public Card ID or number in /collection.")
            .setRequired(true),
        )
        .addIntegerOption((option) =>
          option
            .setName("price")
            .setDescription("Fixed sale price in Gold.")
            .setMinValue(1)
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("buy")
        .setDescription("Buy an active Market listing.")
        .addStringOption(listingOption),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("cancel")
        .setDescription("Cancel your active Market listing.")
        .addStringOption(listingOption),
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
      let embed;
      if (subcommand === "sell") {
        const cardInstanceId = await services.collection.resolveOwnedCardReference({
          playerId: player.playerId,
          cardReference: interaction.options.getString("card_id", true),
        });
        result = await services.market.createListing({
          sellerPlayerId: player.playerId,
          cardInstanceId,
          priceGold: interaction.options.getInteger("price", true),
        });
        embed = createMarketListingEmbed(result);
      } else if (subcommand === "buy") {
        result = await services.market.buyListing({
          buyerPlayerId: player.playerId,
          listingId: interaction.options.getString("listing_id", true),
        });
        embed = createMarketPurchaseEmbed(result);
      } else if (subcommand === "cancel") {
        result = await services.market.cancelListing({
          sellerPlayerId: player.playerId,
          listingId: interaction.options.getString("listing_id", true),
        });
        embed = createMarketCancellationEmbed(result);
      } else {
        result = await services.market.listActiveListings();
        embed = createMarketBrowseEmbed(result);
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      if (error instanceof MarketError || error instanceof CardError) {
        await interaction.editReply({ content: error.message, embeds: [] });
        return;
      }
      throw error;
    }
  },
});
