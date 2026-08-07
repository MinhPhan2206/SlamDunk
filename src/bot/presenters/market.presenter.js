import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import { formatRarity } from "../../config/rarity-config.js";
import { formatNumber, formatPositions } from "../ui/formatters.js";
import { UI_COLORS } from "../ui/theme.js";

function gold(value) {
  return `${formatNumber(value)} Gold`;
}

function listingBlock(listing) {
  const positions = formatPositions(listing);
  return [
    `**#${listing.listingId} • ${listing.playerName}**`,
    `${formatRarity(listing.rarityCode)}${positions ? ` • ${positions}` : ""} • ` +
      `Lv.${listing.cardLevel} • \`!${listing.publicCardId}\``,
    `**${gold(listing.priceGold)}** • Seller: ${listing.sellerName}`,
  ].join("\n");
}

export function createMarketBrowseEmbed({
  listings,
  page = 1,
  totalPages = 0,
  total = "0",
}) {
  const embed = new EmbedBuilder()
    .setColor(UI_COLORS.secondary)
    .setTitle("Market");
  if (listings.length === 0) {
    return embed.setDescription("There are no active Market listings.");
  }
  return embed
    .setDescription(listings.map(listingBlock).join("\n\n"))
    .setFooter({
      text: `Page ${page}/${Math.max(totalPages, 1)} • ${total} Active Listings`,
    });
}

export function createMarketBrowsePayload(result, { discordUserId }) {
  const components = [];
  if (result.totalPages > 1) {
    components.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`market-page:${discordUserId}:${result.page - 1}`)
        .setEmoji("◀️")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(result.page <= 1),
      new ButtonBuilder()
        .setCustomId(`market-page:${discordUserId}:${result.page + 1}`)
        .setEmoji("▶️")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(result.page >= result.totalPages),
    ));
  }
  return { embeds: [createMarketBrowseEmbed(result)], components };
}

export function createMarketListingEmbed({ listing, card }) {
  return new EmbedBuilder()
    .setColor(UI_COLORS.success)
    .setTitle("Market Listing Created")
    .setDescription(`Card \`!${card.publicCardId}\` is now listed.`)
    .addFields(
      { name: "Listing ID", value: `\`${listing.listingId}\``, inline: true },
      { name: "Price", value: gold(listing.priceGold), inline: true },
    );
}

export function createMarketCancellationEmbed({ listing }) {
  return new EmbedBuilder()
    .setColor(UI_COLORS.neutral)
    .setTitle("Market Listing Cancelled")
    .setDescription(`Listing \`${listing.listingId}\` has been cancelled.`);
}

export function createMarketPurchaseEmbed({ listing, card, economy }) {
  return new EmbedBuilder()
    .setColor(UI_COLORS.success)
    .setTitle("Market Purchase Complete")
    .setDescription(`You now own Card \`!${card.publicCardId}\`.`)
    .addFields(
      { name: "Price", value: gold(listing.priceGold), inline: true },
      {
        name: "Gold Balance",
        value: formatNumber(economy.debit.balanceAfter),
        inline: true,
      },
    );
}
