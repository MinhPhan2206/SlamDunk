import { formatNumber } from "../ui/formatters.js";
import { UI_EMOJIS } from "../ui/emojis.js";
import { createUiEmbed } from "../ui/presentation.js";
import { UI_COLORS } from "../ui/theme.js";

const ITEM_ICONS = Object.freeze({
  LEVEL_UP: UI_EMOJIS.levelUp.mention,
  EVENT_TICKET: "🎟️",
  PACK_TICKET: "🎟️",
  CARD_KEY: "🗝️",
});

function itemIcon(itemType) {
  return ITEM_ICONS[itemType] ?? "📦";
}

export function createBagEmbed({ shardBalance, items, displayName, thumbnailUrl }) {
  const lines = [
    `${UI_EMOJIS.shard.mention} **Shards** · ${formatNumber(shardBalance)}`,
    ...items.map((item) =>
      `${itemIcon(item.itemType)} **${item.itemName}** · ${formatNumber(item.quantity)}`
    ),
  ];
  const embed = createUiEmbed({ title: "BAG", color: UI_COLORS.secondary })
    .setAuthor({ name: displayName })
    .setDescription(lines.join("\n"));
  if (thumbnailUrl) embed.setThumbnail(thumbnailUrl);
  return embed;
}
