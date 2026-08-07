import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import { formatCardLine } from "../ui/formatters.js";
import { UI_COLORS } from "../ui/theme.js";

export function createCollectionEmbed(
  result,
  { title = "Your Collection", thumbnailUrl } = {},
) {
  const embed = new EmbedBuilder()
    .setColor(UI_COLORS.primary)
    .setTitle(title);
  if (thumbnailUrl) embed.setThumbnail(thumbnailUrl);
  if (result.cards.length === 0) {
    embed.setDescription(
      title === "Your Collection"
        ? "You do not own any active cards yet. Use `/drop` or `/pack` to get started."
        : "This Player does not own any active cards yet.",
    );
  } else {
    embed.setDescription(result.cards.map((card) =>
      formatCardLine(card, { position: card.collectionPosition })
    ).join("\n"));
  }
  return embed.setFooter({
    text: `Page ${result.page}/${Math.max(result.totalPages, 1)} • ` +
      `${result.total} Cards • Sort: ${result.sortLabel}`,
  });
}

export function createCollectionPayload(
  result,
  { discordUserId, playerId, title = "Your Collection", thumbnailUrl },
) {
  const components = [];
  if (result.totalPages > 1) {
    components.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`collection-page:${discordUserId}:${playerId}:${result.page - 1}`)
          .setEmoji("◀️")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(result.page <= 1),
        new ButtonBuilder()
          .setCustomId(`collection-page:${discordUserId}:${playerId}:${result.page + 1}`)
          .setEmoji("▶️")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(result.page >= result.totalPages),
      ),
    );
  }
  return {
    embeds: [createCollectionEmbed(result, { title, thumbnailUrl })],
    components,
  };
}
