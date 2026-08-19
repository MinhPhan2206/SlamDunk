import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";

import { UI_COLORS } from "./theme.js";

export function createUiEmbed({ title, color = UI_COLORS.primary }) {
  return new EmbedBuilder().setColor(color).setTitle(title);
}

export function createPaginationRow({
  previousCustomId,
  nextCustomId,
  page,
  totalPages,
}) {
  if (totalPages <= 1) return null;
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(previousCustomId)
      .setEmoji("◀️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 1),
    new ButtonBuilder()
      .setCustomId(nextCustomId)
      .setEmoji("▶️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages),
  );
}

export function pageFooter({
  page,
  totalPages,
  requesterLine = null,
  statusLine = null,
}) {
  return [
    `Page ${page} of ${Math.max(totalPages, 1)}`,
    requesterLine,
    statusLine,
  ].filter(Boolean).join("\n");
}

export function requesterLine(user, member = null) {
  const displayName = member?.displayName ?? user?.globalName ?? user?.username;
  return displayName ? `Requested by ${displayName}` : null;
}

export function requesterContextFromEmbed(embed) {
  const footer = embed?.footer;
  return {
    requesterLine: footer?.text
      ?.split("\n")
      .find((line) => line.startsWith("Requested by ")) ?? null,
    requesterIconUrl: footer?.iconURL ?? null,
  };
}
