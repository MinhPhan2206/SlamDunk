import { EmbedBuilder } from "discord.js";

const COLLECTION_COLOR = 0xf28c28;

function formatCard(card) {
  const positions = [card.primaryPosition, card.secondaryPosition]
    .filter(Boolean)
    .join("/");

  return [
    `**${card.playerName} - ${card.edition}**`,
    `Tier ${card.rarityTier} | OVR ${card.overall} | ${positions} | Level ${card.cardLevel} | #${card.serialNumber}`,
  ].join("\n");
}

export function createCollectionEmbed(result) {
  const embed = new EmbedBuilder()
    .setColor(COLLECTION_COLOR)
    .setTitle("Your Collection");

  if (result.cards.length === 0) {
    embed.setDescription(
      result.rarityTier
        ? `No active cards found in Tier ${result.rarityTier}.`
        : "You do not own any active cards yet.",
    );
  } else {
    embed.setDescription(result.cards.map(formatCard).join("\n\n"));
  }

  return embed.setFooter({
    text: `Page ${result.page}/${Math.max(result.totalPages, 1)} | ${result.total} cards`,
  });
}
