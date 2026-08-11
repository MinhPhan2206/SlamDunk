import { EmbedBuilder } from "discord.js";

import { formatNumber } from "../ui/formatters.js";
import { UI_COLORS } from "../ui/theme.js";

const ITEM_ICONS = Object.freeze({
  LEVEL_UP: "⬆️",
  EVENT_TICKET: "🎟️",
  PACK_TICKET: "🎟️",
  CARD_KEY: "🗝️",
});

function itemIcon(itemType) {
  return ITEM_ICONS[itemType] ?? "📦";
}

export function createBagEmbed({ shardBalance, items, displayName, thumbnailUrl }) {
  const lines = [
    `💎 **Shards** · ${formatNumber(shardBalance)}`,
    ...items.map((item) =>
      `${itemIcon(item.itemType)} **${item.itemName}** · ${formatNumber(item.quantity)}`
    ),
  ];
  const embed = new EmbedBuilder()
    .setColor(UI_COLORS.secondary)
    .setTitle(`${displayName}'s Bag`)
    .setDescription(lines.join("\n"));
  if (thumbnailUrl) embed.setThumbnail(thumbnailUrl);
  return embed;
}
