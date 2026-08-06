import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import { formatRarity } from "../../config/rarity-config.js";

const MARKET_COLOR = 0x22c55e;

function gold(value) {
  return `${BigInt(value).toLocaleString("en-US")} Gold`;
}

export function createMarketBrowseEmbed({ listings, page = 1, totalPages = 0, total = "0" }) {
  const embed = new EmbedBuilder()
    .setColor(MARKET_COLOR)
    .setTitle("SlamDunk Market");

  if (listings.length === 0) {
    return embed.setDescription("There are no active Market listings.");
  }

  return embed.setDescription(
    listings
      .map(
        (listing) =>
          [
            `**Listing ${listing.listingId} — ${listing.playerName}**`,
            `${formatRarity(listing.rarityCode)} | Lv${listing.cardLevel} | #${listing.serialNumber} | ID !${listing.publicCardId}`,
            `${gold(listing.priceGold)} | Seller: ${listing.sellerName}`,
          ].join("\n"),
      )
      .join("\n\n"),
  ).setFooter({
    text: `Page ${page}/${Math.max(totalPages, 1)} | ${total} active listings`,
  });
}

export function createMarketBrowsePayload(result, { discordUserId }) {
  const components = [];
  if (result.totalPages > 1) {
    components.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`market-page:${discordUserId}:${result.page - 1}`)
          .setLabel("Previous")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(result.page <= 1),
        new ButtonBuilder()
          .setCustomId(`market-page:${discordUserId}:${result.page + 1}`)
          .setLabel("Next")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(result.page >= result.totalPages),
      ),
    );
  }
  return { embeds: [createMarketBrowseEmbed(result)], components };
}

export function createMarketListingEmbed({ listing, card }) {
  return new EmbedBuilder()
    .setColor(MARKET_COLOR)
    .setTitle("Market Listing Created")
    .setDescription(`Card !${card.publicCardId} is now listed.`)
    .addFields(
      { name: "Listing ID", value: listing.listingId, inline: true },
      { name: "Price", value: gold(listing.priceGold), inline: true },
    );
}

export function createMarketCancellationEmbed({ listing }) {
  return new EmbedBuilder()
    .setColor(MARKET_COLOR)
    .setTitle("Market Listing Cancelled")
    .setDescription(`Listing ${listing.listingId} has been cancelled.`);
}

export function createMarketPurchaseEmbed({ listing, card, economy }) {
  return new EmbedBuilder()
    .setColor(MARKET_COLOR)
    .setTitle("Market Purchase Complete")
    .setDescription(`You now own Card !${card.publicCardId}.`)
    .addFields(
      { name: "Price", value: gold(listing.priceGold), inline: true },
      {
        name: "Gold Balance",
        value: economy.debit.balanceAfter,
        inline: true,
      },
    );
}
