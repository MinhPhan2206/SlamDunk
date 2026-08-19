import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} from "discord.js";
import { formatNumber, formatShards } from "../ui/formatters.js";
import { UI_EMOJIS } from "../ui/emojis.js";
import { createUiEmbed } from "../ui/presentation.js";
import { UI_COLORS } from "../ui/theme.js";

function buttons(playerId, quantity, confirmDisabled = true) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`exchange:confirm:${playerId}:level_up:${quantity}`)
      .setLabel("Confirm")
      .setStyle(ButtonStyle.Success)
      .setDisabled(confirmDisabled),
    new ButtonBuilder()
      .setCustomId(`exchange:cancel:${playerId}`)
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Secondary),
  );
}

function quantityButtons(playerId, quantity, maximumQuantity, selected) {
  const selectedCode = selected ? "level_up" : "none";
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`exchange:decrease:${playerId}:${selectedCode}:${quantity}`)
      .setLabel("−")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(quantity <= 1),
    new ButtonBuilder()
      .setCustomId(`exchange:quantity:${playerId}:${selectedCode}:${quantity}`)
      .setLabel(`Quantity: ${quantity}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`exchange:increase:${playerId}:${selectedCode}:${quantity}`)
      .setLabel("+")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(quantity >= maximumQuantity),
  );
}

export function createExchangeMenu({
  playerId,
  shardBalance,
  offers,
  selected = false,
  quantity = 1,
  maximumQuantity = 100,
}) {
  const selectedOffer = selected ? offers[0] : null;
  const select = new StringSelectMenuBuilder()
    .setCustomId(`exchange:select:${playerId}:shard:${quantity}`)
    .setPlaceholder("Select an item")
    .addOptions(offers.map((offer) => ({
      label: offer.outputItemName,
      description:
        `${formatNumber(offer.inputAmount)} Shards • ` +
        `${offer.outputQuantity} ${offer.outputItemName}`,
      value: offer.offerCode,
      emoji: offer.offerCode === "level_up" ? UI_EMOJIS.levelUp.component : undefined,
      default: selected && offer.offerCode === "level_up",
    })));
  return {
    embeds: [createUiEmbed({ title: "EXCHANGE", color: UI_COLORS.secondary })
      .setDescription([
        `Available: **${formatShards(shardBalance)}**`,
        "",
        ...offers.map((offer) =>
          `${offer.offerCode === "level_up" ? `${UI_EMOJIS.levelUp.mention} ` : ""}` +
          `**${offer.outputItemName}** • ${formatShards(offer.inputAmount)}`
        ),
        "",
        `Quantity: **${quantity}**`,
        ...(selectedOffer
          ? [
            `Total: **${formatShards(selectedOffer.inputAmount * quantity)}**`,
            `Receive: ${UI_EMOJIS.levelUp.mention} **${selectedOffer.outputQuantity * quantity} ${selectedOffer.outputItemName}**`,
          ]
          : []),
      ].join("\n"))],
    components: [
      new ActionRowBuilder().addComponents(select),
      quantityButtons(playerId, quantity, maximumQuantity, selected),
      buttons(playerId, quantity, !selected),
    ],
  };
}

export function createExchangeResult(result) {
  return {
    embeds: [createUiEmbed({ title: "EXCHANGE COMPLETE", color: UI_COLORS.success })
      .setDescription(
        `Received ${UI_EMOJIS.levelUp.mention} ` +
        `**${result.offer.outputQuantity} ${result.offer.outputItemName}** ` +
        `for **${formatShards(result.offer.inputAmount)}**.\n` +
        `Remaining: **${formatShards(result.shardBalanceAfter)}**`,
      )],
    components: [],
  };
}
