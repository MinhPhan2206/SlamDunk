import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import { formatRarity } from "../../config/rarity-config.js";
import {
  MARKET_DURATION_CODES,
  resolveMarketDuration,
} from "../../modules/market/index.js";
import { formatGold, formatPositions } from "../ui/formatters.js";
import { UI_COLORS } from "../ui/theme.js";

function gold(value) {
  return formatGold(value);
}

function listingBlock(listing) {
  const positions = formatPositions(listing);
  return [
    `**${listing.playerName} • ${gold(listing.priceGold)}**`,
    `${formatRarity(listing.rarityCode)}${positions ? ` • ${positions}` : ""} • ` +
      `Lv.${listing.cardLevel} • \`!${listing.publicCardId}\` • ` +
      `⏳ <t:${Math.floor(new Date(listing.expiresAt).getTime() / 1_000)}:R>`,
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
    .setDescription(
      `✅ **${listing.playerName} (${formatRarity(listing.rarityCode)})** ` +
      `\`!${card.publicCardId}\` listed for **${gold(listing.priceGold)}**.\n` +
      `Expires <t:${Math.floor(new Date(listing.expiresAt).getTime() / 1_000)}:R>.`,
    );
}

export function createMarketCancellationEmbed({ listing }) {
  return new EmbedBuilder()
    .setColor(UI_COLORS.neutral)
    .setDescription(
      `↩️ **${listing.playerName} (${formatRarity(listing.rarityCode)})** ` +
      `\`!${listing.publicCardId}\` was removed from the Market.`,
    );
}

export function createMarketPurchaseEmbed({ listing, card }) {
  return new EmbedBuilder()
    .setColor(UI_COLORS.success)
    .setDescription(
      `✅ You bought **${listing.playerName} (${formatRarity(listing.rarityCode)})** ` +
      `\`!${card.publicCardId}\` for **${gold(listing.priceGold)}**.`,
    );
}

export function createMarketSellDraftPayload({
  viewerDiscordUserId,
  card,
  priceGold,
  durationIndex,
}) {
  const durationCode = MARKET_DURATION_CODES[durationIndex];
  const duration = resolveMarketDuration(durationCode);
  const state = `${viewerDiscordUserId}:${card.cardInstanceId}:${priceGold}:${durationIndex}`;
  const embed = new EmbedBuilder()
    .setColor(UI_COLORS.secondary)
    .setTitle("Market Listing")
    .setDescription([
      `**${card.playerName} (${formatRarity(card.rarityCode)})** \`!${card.publicCardId}\``,
      `Price · **${gold(priceGold)}**`,
      `Expires · **${duration.label}**`,
    ].join("\n"));
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`market-sell:decrease:${state}`)
      .setEmoji("➖")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(durationIndex === 0),
    new ButtonBuilder()
      .setCustomId(`market-sell:duration:${state}`)
      .setLabel(duration.code)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`market-sell:increase:${state}`)
      .setEmoji("➕")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(durationIndex === MARKET_DURATION_CODES.length - 1),
    new ButtonBuilder()
      .setCustomId(`market-sell:confirm:${state}`)
      .setLabel("Confirm")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`market-sell:cancel:${state}`)
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Danger),
  );
  return { embeds: [embed], components: [row] };
}

export function createMarketSellCancelledPayload(card) {
  return {
    embeds: [new EmbedBuilder()
      .setColor(UI_COLORS.neutral)
      .setDescription(
        `Listing cancelled for **${card.playerName}** \`!${card.publicCardId}\`.`,
      )],
    components: [],
  };
}
