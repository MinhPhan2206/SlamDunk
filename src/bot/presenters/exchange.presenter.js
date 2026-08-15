import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
} from "discord.js";
import { formatNumber, formatShards } from "../ui/formatters.js";
import { UI_EMOJIS } from "../ui/emojis.js";
import { UI_COLORS } from "../ui/theme.js";

function buttons(playerId, confirmDisabled = true) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`exchange:confirm:${playerId}:level_up`)
      .setLabel("Confirm")
      .setStyle(ButtonStyle.Success)
      .setDisabled(confirmDisabled),
    new ButtonBuilder()
      .setCustomId(`exchange:cancel:${playerId}`)
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Secondary),
  );
}

export function createExchangeMenu({
  playerId,
  shardBalance,
  offers,
  selected = false,
}) {
  const select = new StringSelectMenuBuilder()
    .setCustomId(`exchange:select:${playerId}:shard`)
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
    embeds: [new EmbedBuilder()
      .setColor(UI_COLORS.secondary)
      .setTitle("Exchange")
      .setDescription([
        `Available: **${formatShards(shardBalance)}**`,
        "",
        ...offers.map((offer) =>
          `${offer.offerCode === "level_up" ? `${UI_EMOJIS.levelUp.mention} ` : ""}` +
          `**${offer.outputItemName}** • ${formatShards(offer.inputAmount)}`
        ),
      ].join("\n"))],
    components: [new ActionRowBuilder().addComponents(select), buttons(playerId, !selected)],
  };
}

export function createExchangeResult(result) {
  return {
    embeds: [new EmbedBuilder()
      .setColor(UI_COLORS.success)
      .setTitle("Exchange Complete")
      .setDescription(
        `Received ${UI_EMOJIS.levelUp.mention} ` +
        `**${result.offer.outputQuantity} ${result.offer.outputItemName}** ` +
        `for **${formatShards(result.offer.inputAmount)}**.\n` +
        `Remaining: **${formatShards(result.shardBalanceAfter)}**`,
      )],
    components: [],
  };
}
