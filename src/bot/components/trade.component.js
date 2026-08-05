import {
  ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
} from "discord.js";
import { TradeError } from "../../modules/trade/index.js";
import { createTradePayload } from "../presenters/trade.presenter.js";

function modal(action, tradeId) {
  const cards = action === "cards";
  return new ModalBuilder()
    .setCustomId(`trade:${action}:${tradeId}`)
    .setTitle(cards ? "Edit Offered Cards" : "Edit Offered Gold")
    .addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId(cards ? "card_ids" : "gold")
        .setLabel(cards ? "Card IDs, separated by commas (max 10)" : "Gold amount (max 20,000,000)")
        .setStyle(cards ? TextInputStyle.Paragraph : TextInputStyle.Short)
        .setRequired(true)
        .setValue(cards ? "" : "0"),
    ));
}

function parseCardIds(value) {
  const trimmed = value.trim();
  if (!trimmed) return [];
  const ids = trimmed.split(/[ ,\n]+/).filter(Boolean);
  if (ids.some((id) => !/^\d+$/.test(id))) throw new TradeError("INVALID_CARD_IDS", "Card IDs must be positive integers separated by commas.");
  return ids;
}

export const tradeComponent = Object.freeze({
  namespace: "trade",
  async execute(interaction, { services }) {
    const [, action, tradeId] = interaction.customId.split(":");
    if (interaction.isButton() && ["cards", "gold"].includes(action)) {
      await interaction.showModal(modal(action, tradeId));
      return;
    }
    const player = await services.player.getOrCreatePlayer({
      discordUserId: interaction.user.id, usernameSnapshot: interaction.user.username,
    });
    await interaction.deferUpdate();
    try {
      let result;
      if (action === "cards") {
        result = await services.trade.setCardOffer({
          tradeId, playerId: player.playerId,
          cardInstanceIds: parseCardIds(interaction.fields.getTextInputValue("card_ids")),
        });
      } else if (action === "gold") {
        result = await services.trade.setGoldOffer({
          tradeId, playerId: player.playerId,
          goldOffered: interaction.fields.getTextInputValue("gold").trim(),
        });
      } else if (action === "confirm") {
        result = await services.trade.confirmTrade({ tradeId, playerId: player.playerId });
      } else if (action === "cancel") {
        result = await services.trade.cancelTrade({ tradeId, playerId: player.playerId });
      } else {
        throw new TradeError("INVALID_TRADE_ACTION", "Trade action is invalid.");
      }
      await interaction.editReply(createTradePayload(result));
    } catch (error) {
      if (error instanceof TradeError) {
        await interaction.followUp({ content: error.message, ephemeral: true });
        return;
      }
      throw error;
    }
  },
});
