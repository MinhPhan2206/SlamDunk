import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import {
  formatCardLine,
  formatGold,
  formatShards,
} from "../ui/formatters.js";
import { UI_COLORS } from "../ui/theme.js";

const MAX_VISIBLE_CARDS = 20;

function cardLine(card) {
  return `${formatCardLine(card)} • ${formatGold(card.goldReward)} • ` +
    formatShards(card.shardReward);
}

export function createQuicksellPreviewPayload({ session, cards }) {
  const visible = cards.slice(0, MAX_VISIBLE_CARDS).map(cardLine);
  if (cards.length > visible.length) {
    visible.push(`...and ${cards.length - visible.length} more cards.`);
  }
  const embed = new EmbedBuilder()
    .setColor(UI_COLORS.danger)
    .setTitle("Quicksell Preview")
    .setDescription([
      `Destroy **${cards.length} Cards** for **${formatGold(session.totalGold)}** ` +
        `and **${formatShards(session.totalShards)}**?`,
      "Listed, traded, locked, and lineup cards are excluded.",
      "**This action cannot be undone.**",
      "",
      ...visible,
    ].join("\n"));
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
    embeds: [new EmbedBuilder()
      .setColor(UI_COLORS.success)
      .setTitle("Quicksell Complete")
      .setDescription(
        `Destroyed **${cards.length} Cards** for **${formatGold(session.totalGold)}** ` +
        `and **${formatShards(session.totalShards)}**.\n` +
        `Balances: **${formatGold(session.goldBalanceAfter)}** • ` +
        `**${formatShards(session.shardBalanceAfter)}**`,
      )],
    components: [],
  };
}

export function createQuicksellCancelledPayload() {
  return {
    embeds: [new EmbedBuilder()
      .setColor(UI_COLORS.neutral)
      .setTitle("Quicksell Cancelled")
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
  return new EmbedBuilder()
    .setColor(UI_COLORS.success)
    .setTitle("Quicksell Complete")
    .setDescription(formatCardLine(card))
    .addFields(
      {
        name: "Received",
        value: `${formatGold(goldReward)} • ${formatShards(shardReward)}`,
        inline: true,
      },
      {
        name: "Balances",
        value: `${formatGold(goldBalance)} • ${formatShards(shardBalance)}`,
        inline: true,
      },
    );
}
