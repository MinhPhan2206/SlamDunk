import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { formatRarity } from "../../config/rarity-config.js";
import {
  formatCardLine,
  formatGold,
  formatNumber,
  formatShards,
} from "../ui/formatters.js";
import { createUiEmbed } from "../ui/presentation.js";
import { formatCompactPlayerName } from "../ui/player-name.js";
import { compactCodeTable } from "../ui/text-table.js";
import { UI_COLORS } from "../ui/theme.js";

const MAX_VISIBLE_CARDS = 20;

function cardTable(cards) {
  return compactCodeTable([
    { label: "PLAYER", width: 13 },
    { label: "RARITY", width: 9 },
    { label: "LV", width: 2, align: "right" },
    { label: "CARD ID", width: 10, align: "right" },
    { label: "GOLD", width: 6, align: "right" },
    { label: "SHARD", width: 5, align: "right" },
  ], cards.slice(0, MAX_VISIBLE_CARDS).map((card) => [
    formatCompactPlayerName(card.playerName, 13),
    formatRarity(card.rarityCode),
    card.cardLevel,
    `!${card.publicCardId}`,
    formatNumber(card.goldReward),
    formatNumber(card.shardReward),
  ]));
}

export function createQuicksellPreviewPayload({ session, cards }) {
  const hidden = Math.max(0, cards.length - MAX_VISIBLE_CARDS);
  const embed = createUiEmbed({ title: "QUICKSELL REVIEW", color: UI_COLORS.danger })
    .setDescription([
      `**${cards.length} cards** · ${formatGold(session.totalGold)} · ${formatShards(session.totalShards)}`,
      cardTable(cards),
      hidden ? `*+${hidden} additional cards*` : null,
      "Locked, listed, traded, and lineup cards are excluded.",
      "**This action cannot be undone.**",
    ].filter(Boolean).join("\n"));
  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`quicksell:confirm:${session.quicksellSessionId}`)
      .setLabel("Confirm")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`quicksell:cancel:${session.quicksellSessionId}`)
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Secondary),
  );
  return { embeds: [embed], components: [buttons] };
}

export function createQuicksellCompletedPayload({ session, cards }) {
  return {
    embeds: [createUiEmbed({ title: "QUICKSELL COMPLETE", color: UI_COLORS.success })
      .setDescription(
        `**${cards.length} cards sold** · ${formatGold(session.totalGold)} · ` +
        `${formatShards(session.totalShards)}\n` +
        `Balance · ${formatGold(session.goldBalanceAfter)} · ` +
        formatShards(session.shardBalanceAfter),
      )],
    components: [],
  };
}

export function createQuicksellCancelledPayload() {
  return {
    embeds: [createUiEmbed({ title: "QUICKSELL CANCELLED", color: UI_COLORS.neutral })
      .setDescription("No cards were destroyed.")],
    components: [],
  };
}

export function createQuicksellEmbed({
  card,
  goldReward,
  shardReward,
  goldBalance,
  shardBalance,
}) {
  return createUiEmbed({ title: "QUICKSELL COMPLETE", color: UI_COLORS.success })
    .setDescription(formatCardLine(card))
    .addFields(
      {
        name: "RECEIVED",
        value: `${formatGold(goldReward)} · ${formatShards(shardReward)}`,
        inline: true,
      },
      {
        name: "BALANCE",
        value: `${formatGold(goldBalance)} · ${formatShards(shardBalance)}`,
        inline: true,
      },
    );
}
