import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { gameConfig } from "../../config/game-config.js";
import { CardError } from "../../modules/card/index.js";
import { TradeError } from "../../modules/trade/index.js";
import { SecurityAccessError } from "../../modules/security/index.js";
import { createTradePayload } from "../presenters/trade.presenter.js";

function modal(action, tradeId, offerRevision) {
  const cards = action === "cards";
  const operation = new TextInputBuilder()
    .setCustomId("operation")
    .setLabel("Action")
    .setPlaceholder("add or remove")
    .setStyle(TextInputStyle.Short)
    .setMinLength(3)
    .setMaxLength(6)
    .setRequired(true);
  const value = new TextInputBuilder()
    .setCustomId(cards ? "card_ids" : "gold")
    .setLabel(cards ? "Card IDs or collection numbers (max 10)" : "Gold amount (max 20,000,000)")
    .setStyle(cards ? TextInputStyle.Paragraph : TextInputStyle.Short)
    .setRequired(true);
  return new ModalBuilder()
    .setCustomId(`trade:${action}:${tradeId}:${offerRevision}`)
    .setTitle(cards ? "Edit Offered Cards" : "Edit Offered Gold")
    .addComponents(
      new ActionRowBuilder().addComponents(operation),
      new ActionRowBuilder().addComponents(value),
    );
}

function parseOperation(value) {
  const operation = value.trim().toUpperCase();
  if (!["ADD", "REMOVE"].includes(operation)) {
    throw new TradeError("TRADE_OPERATION_INVALID", "Action must be add or remove.");
  }
  return operation;
}

function parseCardIds(value) {
  const ids = value.trim().split(/[ ,\n]+/).filter(Boolean);
  if (
    ids.length === 0 ||
    ids.some((id) => !/^!?\d+$/.test(id))
  ) {
    throw new TradeError(
      "INVALID_CARD_IDS",
      "Enter one or more Card IDs or collection numbers separated by commas.",
    );
  }
  return ids;
}

export const tradeComponent = Object.freeze({
  namespace: "trade",
  componentInactivityTimeoutMs: gameConfig.trade.expiryMinutes * 60_000,
  async execute(interaction, { services }) {
    const [, action, tradeId, offerRevision] = interaction.customId.split(":");
    if (interaction.isButton() && ["cards", "gold"].includes(action)) {
      await interaction.showModal(modal(action, tradeId, offerRevision));
      return;
    }
    const player = await services.player.getOrCreatePlayer({
      discordUserId: interaction.user.id,
      usernameSnapshot: interaction.user.username,
    });
    await interaction.deferUpdate();
    try {
      if (!["decline", "cancel"].includes(action)) {
        await services.security?.assertAccess({
          player,
          discordUser: interaction.user,
          feature: "TRADE",
        });
      }
      let result;
      if (action === "accept") {
        result = await services.trade.acceptTrade({
          tradeId,
          playerId: player.playerId,
        });
      } else if (["decline", "cancel"].includes(action)) {
        result = await services.trade.cancelTrade({
          tradeId,
          playerId: player.playerId,
        });
      } else if (action === "cards") {
        const operation = parseOperation(
          interaction.fields.getTextInputValue("operation"),
        );
        const references = parseCardIds(
          interaction.fields.getTextInputValue("card_ids"),
        );
        const cardInstanceIds = await Promise.all(references.map((cardReference) =>
          services.collection.resolveOwnedCardReference({
            playerId: player.playerId,
            cardReference,
          })
        ));
        result = await services.trade.setCardOffer({
          tradeId,
          playerId: player.playerId,
          cardInstanceIds,
          operation,
          offerRevision,
        });
      } else if (action === "gold") {
        result = await services.trade.setGoldOffer({
          tradeId,
          playerId: player.playerId,
          goldOffered: interaction.fields.getTextInputValue("gold").trim(),
          operation: parseOperation(
            interaction.fields.getTextInputValue("operation"),
          ),
          offerRevision,
        });
      } else if (action === "ready") {
        result = await services.trade.readyTrade({
          tradeId,
          playerId: player.playerId,
          offerRevision,
        });
      } else if (action === "undo") {
        result = await services.trade.undoReady({
          tradeId,
          playerId: player.playerId,
          offerRevision,
        });
      } else if (action === "final") {
        result = await services.trade.finalAcceptTrade({
          tradeId,
          playerId: player.playerId,
          offerRevision,
        });
      } else {
        throw new TradeError("INVALID_TRADE_ACTION", "Trade action is invalid.");
      }
      await interaction.editReply(createTradePayload(result));
    } catch (error) {
      if (
        error instanceof TradeError ||
        error instanceof CardError ||
        error instanceof SecurityAccessError
      ) {
        await interaction.followUp({ content: error.message, ephemeral: true });
        return;
      }
      throw error;
    }
  },
});
