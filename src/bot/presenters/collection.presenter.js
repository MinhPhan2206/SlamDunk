import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import { formatRarity } from "../../config/rarity-config.js";

const COLLECTION_COLOR = 0xf28c28;

function formatCard(card) {
  const positions = [card.primaryPosition, card.secondaryPosition]
    .filter(Boolean)
    .join("/");

  return [
    `**${card.collectionPosition}. ${card.playerName}**`,
    `${card.userLock ? "🔒 | " : ""}${formatRarity(card.rarityCode)} | OVR ${card.overall} | ${positions} | Level ${card.cardLevel} | #${card.serialNumber} | ID !${card.publicCardId}`,
  ].join("\n");
}

export function createCollectionEmbed(result, { title = "Your Collection" } = {}) {
  const embed = new EmbedBuilder()
    .setColor(COLLECTION_COLOR)
    .setTitle(title);

  if (result.cards.length === 0) {
    embed.setDescription(
      title === "Your Collection"
        ? "You do not own any active cards yet."
        : "This Player does not own any active cards yet.",
    );
  } else {
    embed.setDescription(result.cards.map(formatCard).join("\n\n"));
  }

  return embed.setFooter({
    text: `Page ${result.page}/${Math.max(result.totalPages, 1)} | ${result.total} cards | Sort: ${result.sortLabel}`,
  });
}

export function createCollectionPayload(
  result,
  { discordUserId, playerId, title = "Your Collection" },
) {
  const components = [];
  if (result.totalPages > 1) {
    components.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`collection-page:${discordUserId}:${playerId}:${result.page - 1}`)
          .setLabel("Previous")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(result.page <= 1),
        new ButtonBuilder()
          .setCustomId(`collection-page:${discordUserId}:${playerId}:${result.page + 1}`)
          .setLabel("Next")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(result.page >= result.totalPages),
      ),
    );
  }
  return { embeds: [createCollectionEmbed(result, { title })], components };
}
