import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
  StringSelectMenuBuilder,
} from "discord.js";

function buttons(playerId, confirmDisabled = true) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`exchange:confirm:${playerId}:level_up`).setLabel("Confirm").setStyle(ButtonStyle.Success).setDisabled(confirmDisabled),
    new ButtonBuilder().setCustomId(`exchange:cancel:${playerId}`).setLabel("Cancel").setStyle(ButtonStyle.Danger),
  );
}

export function createExchangeMenu({ playerId, shardBalance, offers, selected = false }) {
  const select = new StringSelectMenuBuilder()
    .setCustomId(`exchange:select:${playerId}:shard`)
    .setPlaceholder("Exchange Item Received")
    .addOptions(offers.map((offer) => ({
      label: offer.outputItemName,
      description: `${offer.inputAmount} Shards for ${offer.outputQuantity} ${offer.outputItemName}`,
      value: offer.offerCode,
      default: selected && offer.offerCode === "level_up",
    })));
  return {
    embeds: [new EmbedBuilder()
      .setColor(0x2563eb)
      .setTitle("Exchange Menu")
      .setDescription([
        `Shard Count: **${shardBalance}**`,
        ...offers.map((offer) => `💠 **${offer.inputAmount} Shards** ⇒ **${offer.outputItemName}**`),
      ].join("\n\n"))],
    components: [new ActionRowBuilder().addComponents(select), buttons(playerId, !selected)],
  };
}

export function createExchangeResult(result) {
  return {
    content: `Exchanged **${result.offer.inputAmount} Shards** for **${result.offer.outputQuantity} ${result.offer.outputItemName}**. Shards remaining: **${result.shardBalanceAfter}**.`,
    embeds: [], components: [],
  };
}
