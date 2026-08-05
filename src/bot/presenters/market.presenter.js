import { EmbedBuilder } from "discord.js";
import { formatRarity } from "../../config/rarity-config.js";

const MARKET_COLOR = 0x22c55e;

function gold(value) {
  return `${BigInt(value).toLocaleString("en-US")} Gold`;
}

export function createMarketBrowseEmbed({ listings }) {
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
            `**Listing ${listing.listingId} — ${listing.playerName} - ${listing.edition}**`,
            `${formatRarity(listing.rarityCode)} | Lv${listing.cardLevel} | #${listing.serialNumber} | Card ${listing.cardInstanceId}`,
            `${gold(listing.priceGold)} | Seller: ${listing.sellerName}`,
          ].join("\n"),
      )
      .join("\n\n"),
  );
}

export function createMarketListingEmbed({ listing }) {
  return new EmbedBuilder()
    .setColor(MARKET_COLOR)
    .setTitle("Market Listing Created")
    .setDescription(`Card ${listing.cardInstanceId} is now listed.`)
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
    .setDescription(`You now own Card ${card.cardInstanceId}.`)
    .addFields(
      { name: "Price", value: gold(listing.priceGold), inline: true },
      {
        name: "Gold Balance",
        value: economy.debit.balanceAfter,
        inline: true,
      },
    );
}
