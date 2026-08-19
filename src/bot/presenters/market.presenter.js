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
import { formatGold, formatNumber, formatPositions } from "../ui/formatters.js";
import {
  createPaginationRow,
  createUiEmbed,
  pageFooter,
} from "../ui/presentation.js";
import { formatCompactPlayerName } from "../ui/player-name.js";
import { compactCodeTable } from "../ui/text-table.js";
import { UI_COLORS } from "../ui/theme.js";

function expiryLabel(value) {
  const remaining = new Date(value).getTime() - Date.now();
  if (remaining <= 0) return "Expired";
  const minutes = Math.max(1, Math.ceil(remaining / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.ceil(minutes / 60);
  return hours < 48 ? `${hours}h` : `${Math.ceil(hours / 24)}d`;
}

export function createMarketBrowseEmbed({
  listings,
  page = 1,
  totalPages = 0,
  total = "0",
  requesterLine = null,
  requesterIconUrl = null,
}) {
  const embed = createUiEmbed({ title: "MARKET", color: UI_COLORS.secondary });
  if (listings.length === 0) {
    embed.setDescription("No active listings.");
  } else {
    embed.setDescription(compactCodeTable([
      { label: "PLAYER", width: 15 },
      { label: "RARITY", width: 9 },
      { label: "LV", width: 2, align: "right" },
      { label: "PRICE", width: 10, align: "right" },
      { label: "LEFT", width: 5, align: "right" },
      { label: "CARD ID", width: 10, align: "right" },
    ], listings.map((listing) => [
      formatCompactPlayerName(listing.playerName),
      formatRarity(listing.rarityCode),
      listing.cardLevel,
      formatNumber(listing.priceGold),
      expiryLabel(listing.expiresAt),
      `!${listing.publicCardId}`,
    ])));
  }
  return embed.setFooter({
    text: pageFooter({
      page,
      totalPages,
      requesterLine,
      statusLine: `${formatNumber(total)} active listings`,
    }),
    iconURL: requesterIconUrl ?? undefined,
  });
}

export function createMarketBrowsePayload(result, {
  discordUserId,
  requesterLine = null,
  requesterIconUrl = null,
}) {
  const row = createPaginationRow({
    previousCustomId: `market-page:${discordUserId}:${result.page - 1}`,
    nextCustomId: `market-page:${discordUserId}:${result.page + 1}`,
    page: result.page,
    totalPages: result.totalPages,
  });
  return {
    embeds: [createMarketBrowseEmbed({ ...result, requesterLine, requesterIconUrl })],
    components: row ? [row] : [],
  };
}

export function createMarketListingEmbed({ listing, card }) {
  return createUiEmbed({ title: "LISTING CREATED", color: UI_COLORS.success })
    .setDescription(
      `**${listing.playerName}** \`!${card.publicCardId}\`\n` +
      `${formatRarity(listing.rarityCode)} · ${formatGold(listing.priceGold)}\n` +
      `Expires <t:${Math.floor(new Date(listing.expiresAt).getTime() / 1_000)}:R>`,
    );
}

export function createMarketCancellationEmbed({ listing }) {
  return createUiEmbed({ title: "LISTING REMOVED", color: UI_COLORS.neutral })
    .setDescription(
      `**${listing.playerName}** \u00B7 ${formatRarity(listing.rarityCode)} \u00B7 Lv.${listing.cardLevel}\n` +
      `\`!${listing.publicCardId}\` returned to your Collection.`,
    );
}

export function createMarketPurchaseEmbed({ listing, card }) {
  return createUiEmbed({ title: "PURCHASE COMPLETE", color: UI_COLORS.success })
    .setDescription(
      `**${listing.playerName}** \`!${card.publicCardId}\` acquired for ${formatGold(listing.priceGold)}.`,
    );
}

export function createMarketSellDraftPayload({
  viewerDiscordUserId,
  card,
  priceGold,
  durationIndex,
}) {
  const duration = resolveMarketDuration(MARKET_DURATION_CODES[durationIndex]);
  const state = `${viewerDiscordUserId}:${card.cardInstanceId}:${priceGold}:${durationIndex}`;
  const embed = createUiEmbed({ title: "CREATE LISTING", color: UI_COLORS.secondary })
    .setDescription(`**${card.playerName}** · ${formatRarity(card.rarityCode)} · \`!${card.publicCardId}\``)
    .addFields(
      { name: "PRICE", value: formatGold(priceGold), inline: true },
      { name: "DURATION", value: duration.label, inline: true },
    );
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
      .setStyle(ButtonStyle.Secondary),
  );
  return { embeds: [embed], components: [row] };
}

export function createMarketSellCancelledPayload(card) {
  return {
    embeds: [createUiEmbed({ title: "LISTING CANCELLED", color: UI_COLORS.neutral })
      .setDescription(`**${card.playerName}** \`!${card.publicCardId}\` was not listed.`)],
    components: [],
  };
}
