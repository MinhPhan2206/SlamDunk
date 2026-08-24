import { SlashCommandBuilder } from "discord.js";

import { CardError } from "../../modules/card/index.js";
import {
  DEFAULT_MARKET_DURATION_CODE,
  MARKET_DURATION_CODES,
  MarketError,
} from "../../modules/market/index.js";
import {
  createMarketBrowsePayload,
  createMarketCancellationEmbed,
  createMarketPurchaseEmbed,
  createMarketSellDraftPayload,
} from "../presenters/market.presenter.js";
import { requesterLine } from "../ui/presentation.js";
import { SecurityAccessError } from "../../modules/security/index.js";

function cardIdOption(option, description) {
  return option
    .setName("card_id")
    .setDescription(description)
    .setRequired(true);
}

function publicCardId(value) {
  return value.trim().replace(/^!/, "");
}

async function playerFor(interaction, services) {
  return services.player.getOrCreatePlayer({
    discordUserId: interaction.user.id,
    usernameSnapshot: interaction.user.username,
  });
}

async function executeSafely(interaction, operation) {
  await interaction.deferReply();
  try {
    await operation();
  } catch (error) {
    if (
      error instanceof MarketError ||
      error instanceof CardError ||
      error instanceof SecurityAccessError
    ) {
      await interaction.editReply({ content: error.message, embeds: [] });
      return;
    }
    throw error;
  }
}

export const marketCommand = Object.freeze({
  data: new SlashCommandBuilder()
    .setName("market")
    .setDescription("View active Card listings.")
    .addIntegerOption((option) => option
      .setName("page")
      .setDescription("Market page number.")
      .setMinValue(1)),
  async execute(interaction, { services }) {
    await executeSafely(interaction, async () => {
      await playerFor(interaction, services);
      const result = await services.market.listActiveListings({
        page: interaction.options.getInteger("page") ?? 1,
      });
      await interaction.editReply(createMarketBrowsePayload(result, {
        discordUserId: interaction.user.id,
        requesterLine: requesterLine(interaction.user, interaction.member),
        requesterIconUrl: interaction.user.displayAvatarURL?.() ?? null,
      }));
    });
  },
});

export const sellCommand = Object.freeze({
  data: new SlashCommandBuilder()
    .setName("sell")
    .setDescription("List one of your Cards on the Market.")
    .addStringOption((option) => cardIdOption(
      option,
      "Public Card ID or number in /collection.",
    ).setMaxLength(10))
    .addIntegerOption((option) => option
      .setName("price")
      .setDescription("Sale price in Gold.")
      .setMinValue(1)
      .setRequired(true)),
  async execute(interaction, { services }) {
    const cardReference = interaction.options.getString("card_id", true).trim();
    if (!/^!?\d+$/.test(cardReference)) {
      await interaction.reply({ content: "Card ID must be a public Card ID or Collection number." });
      return;
    }
    await executeSafely(interaction, async () => {
      const player = await playerFor(interaction, services);
      await services.security?.assertAccess({
        player,
        discordUser: interaction.user,
        feature: "MARKET",
      });
      const cardInstanceId = await services.collection.resolveOwnedCardReference({
        playerId: player.playerId,
        cardReference,
      });
      const card = await services.cardView.getInstance(cardInstanceId);
      await interaction.editReply(createMarketSellDraftPayload({
        viewerDiscordUserId: interaction.user.id,
        card,
        priceGold: interaction.options.getInteger("price", true),
        durationIndex: MARKET_DURATION_CODES.indexOf(DEFAULT_MARKET_DURATION_CODE),
      }));
    });
  },
});

export const unlistCommand = Object.freeze({
  data: new SlashCommandBuilder()
    .setName("unlist")
    .setDescription("Remove one of your Cards from the Market.")
    .addStringOption((option) => cardIdOption(option, "Public Card ID.")),
  async execute(interaction, { services }) {
    await executeSafely(interaction, async () => {
      const player = await playerFor(interaction, services);
      const result = await services.market.cancelListing({
        sellerPlayerId: player.playerId,
        publicCardId: publicCardId(interaction.options.getString("card_id", true)),
      });
      await interaction.editReply({
        embeds: [createMarketCancellationEmbed(result)],
      });
    });
  },
});

export const buyCommand = Object.freeze({
  data: new SlashCommandBuilder()
    .setName("buy")
    .setDescription("Buy a Card listed on the Market.")
    .addStringOption((option) => cardIdOption(option, "Public Card ID.")),
  async execute(interaction, { services }) {
    await executeSafely(interaction, async () => {
      const player = await playerFor(interaction, services);
      await services.security?.assertAccess({
        player,
        discordUser: interaction.user,
        feature: "MARKET",
      });
      const result = await services.market.buyListing({
        buyerPlayerId: player.playerId,
        publicCardId: publicCardId(interaction.options.getString("card_id", true)),
      });
      await interaction.editReply({ embeds: [createMarketPurchaseEmbed(result)] });
    });
  },
});
