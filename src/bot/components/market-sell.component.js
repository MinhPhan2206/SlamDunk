import { MessageFlags } from "discord.js";

import { CardError } from "../../modules/card/index.js";
import {
  MARKET_DURATION_CODES,
  MarketError,
} from "../../modules/market/index.js";
import {
  createMarketListingEmbed,
  createMarketSellCancelledPayload,
  createMarketSellDraftPayload,
} from "../presenters/market.presenter.js";

const ACTIONS = new Set(["decrease", "increase", "confirm", "cancel"]);

async function sendMarketError(interaction, error) {
  const payload = { content: error.message, flags: MessageFlags.Ephemeral };
  if (interaction.deferred || interaction.replied) {
    await interaction.followUp(payload);
  } else {
    await interaction.reply(payload);
  }
}

export const marketSellComponent = Object.freeze({
  namespace: "market-sell",

  async execute(interaction, { services }) {
    const [, action, ownerDiscordUserId, cardInstanceId, priceGold, indexValue] =
      interaction.customId.split(":");
    const durationIndex = Number(indexValue);
    if (
      !ACTIONS.has(action) ||
      !/^\d+$/.test(ownerDiscordUserId ?? "") ||
      !/^\d+$/.test(cardInstanceId ?? "") ||
      !/^\d+$/.test(priceGold ?? "") ||
      !Number.isInteger(durationIndex) ||
      durationIndex < 0 ||
      durationIndex >= MARKET_DURATION_CODES.length
    ) {
      throw new Error("Invalid Market Sell interaction.");
    }
    if (interaction.user.id !== ownerDiscordUserId) {
      await interaction.reply({
        content: "Only the seller can edit this Market listing.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      const card = await services.cardView.getInstance(cardInstanceId);
      if (action === "cancel") {
        await interaction.update(createMarketSellCancelledPayload(card));
        return;
      }
      if (action === "decrease" || action === "increase") {
        const change = action === "decrease" ? -1 : 1;
        const nextIndex = Math.min(
          Math.max(durationIndex + change, 0),
          MARKET_DURATION_CODES.length - 1,
        );
        await interaction.update(createMarketSellDraftPayload({
          viewerDiscordUserId: ownerDiscordUserId,
          card,
          priceGold,
          durationIndex: nextIndex,
        }));
        return;
      }

      await interaction.deferUpdate();
      const player = await services.player.getOrCreatePlayer({
        discordUserId: interaction.user.id,
        usernameSnapshot: interaction.user.username,
      });
      const result = await services.market.createListing({
        sellerPlayerId: player.playerId,
        cardInstanceId,
        priceGold,
        durationCode: MARKET_DURATION_CODES[durationIndex],
      });
      await interaction.editReply({
        embeds: [createMarketListingEmbed(result)],
        components: [],
      });
    } catch (error) {
      if (error instanceof MarketError || error instanceof CardError) {
        await sendMarketError(interaction, error);
        return;
      }
      throw error;
    }
  },
});
