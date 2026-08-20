import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} from "discord.js";

import { formatPositions, truncateText } from "../ui/formatters.js";
import { createUiEmbed } from "../ui/presentation.js";
import { rarityColor, UI_COLORS } from "../ui/theme.js";

const SELECT_PAGE_SIZE = 25;

function cardSummary(card) {
  return `**${card.playerName}** · ${card.rarityName} · ${formatPositions(card)}\n` +
    `Lv.${card.cardLevel} · \`!${card.publicCardId}\``;
}

export function createLevelUpReviewPayload({ card, previousLevel, newLevel }, viewerId) {
  const embed = createUiEmbed({
    title: "LEVEL UP REVIEW",
    color: rarityColor(card.rarityCode),
  }).setDescription([
    cardSummary(card),
    "",
    `Current Level · **${previousLevel}**`,
    `New Level · **${newLevel}**`,
  ].join("\n"));
  return {
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`upgrade:level_confirm:${viewerId}:${card.cardInstanceId}`)
        .setLabel("Confirm")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`upgrade:cancel:${viewerId}`)
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Secondary),
    )],
  };
}

export function createFusionPlayerSelectionPayload(groups, viewerId, requestedPage = 1) {
  const totalPages = Math.max(1, Math.ceil(groups.length / SELECT_PAGE_SIZE));
  const page = Math.min(Math.max(Number(requestedPage) || 1, 1), totalPages);
  const visible = groups.slice((page - 1) * SELECT_PAGE_SIZE, page * SELECT_PAGE_SIZE);
  const select = new StringSelectMenuBuilder()
    .setCustomId(`upgrade:player_select:${viewerId}:${page}`)
    .setPlaceholder("Select a player to upgrade")
    .addOptions(visible.map((group) => ({
      label: truncateText(`${group.playerName} · ${group.rarityName}`, 100),
      description: truncateText(
        `${group.cardCount} eligible cards · ${formatPositions(group)}`,
        100,
      ),
      value: String(group.cardTemplateId),
    })));
  return {
    embeds: [createUiEmbed({ title: "SELECT PLAYER", color: UI_COLORS.primary })
      .setDescription(`Players available for Fusion · **${groups.length}**\nPage ${page} of ${totalPages}`)],
    components: [
      new ActionRowBuilder().addComponents(select),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`upgrade:player_page:${viewerId}:${page - 1}`)
          .setEmoji("◀️")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page <= 1),
        new ButtonBuilder()
          .setCustomId(`upgrade:player_page:${viewerId}:${page + 1}`)
          .setEmoji("▶️")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page >= totalPages),
        new ButtonBuilder()
          .setCustomId(`upgrade:cancel:${viewerId}`)
          .setLabel("Cancel")
          .setStyle(ButtonStyle.Secondary),
      ),
    ],
  };
}

export function createFusionMaterialSelectionPayload(
  { group, cards },
  viewerId,
  selectedIds = [],
) {
  const visible = cards.slice(0, SELECT_PAGE_SIZE);
  const selected = new Set(selectedIds.map(String));
  const select = new StringSelectMenuBuilder()
    .setCustomId(`upgrade:materials_select:${viewerId}:${group.cardTemplateId}`)
    .setPlaceholder("Select 2–5 Fusion materials")
    .setMinValues(2)
    .setMaxValues(Math.min(5, visible.length))
    .addOptions(visible.map((card) => ({
      label: `Lv.${card.cardLevel} · !${card.publicCardId}`,
      description: card.userLock ? "Locked card" : "Available material",
      value: String(card.cardInstanceId),
      default: selected.has(String(card.cardInstanceId)),
    })));
  const hidden = Math.max(0, cards.length - visible.length);
  return {
    embeds: [createUiEmbed({ title: "SELECT FUSION MATERIALS", color: rarityColor(group.rarityCode) })
      .setDescription([
        `**${group.playerName}** · ${group.rarityName} · ${formatPositions(group)}`,
        `Eligible Cards · **${cards.length}**`,
        hidden ? `Showing the first ${visible.length} cards.` : null,
        "Select between **2 and 5** cards.",
      ].filter(Boolean).join("\n"))],
    components: [
      new ActionRowBuilder().addComponents(select),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`upgrade:players:${viewerId}`)
          .setLabel("Back")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`upgrade:cancel:${viewerId}`)
          .setLabel("Cancel")
          .setStyle(ButtonStyle.Secondary),
      ),
    ],
  };
}

export function createFusionReviewPayload(
  { group, cards, resultLevel, sessionId },
  viewerId,
) {
  const materials = cards
    .map((card) => `Lv.${card.cardLevel} · \`!${card.publicCardId}\``)
    .join("\n");
  return {
    embeds: [createUiEmbed({ title: "FUSION REVIEW", color: rarityColor(group.rarityCode) })
      .setDescription(`**${group.playerName}** · ${group.rarityName}`)
      .addFields(
        { name: "MATERIALS", value: materials },
        { name: "RESULT", value: `Lv.${resultLevel} · New Card ID` },
      )],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`upgrade:fusion_confirm:${viewerId}:${sessionId}`)
        .setLabel("Confirm")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`upgrade:fusion_change:${viewerId}:${sessionId}`)
        .setLabel("Change Cards")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`upgrade:cancel:${viewerId}`)
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Secondary),
    )],
  };
}

export function createUpgradeCancelledPayload() {
  return {
    embeds: [createUiEmbed({ title: "UPGRADE CANCELLED", color: UI_COLORS.neutral })
      .setDescription("No cards or items were changed.")],
    components: [],
  };
}

export function createFusionEmbed({ sourceCards, resultCard }) {
  return createUiEmbed({ title: "FUSION COMPLETE", color: UI_COLORS.success })
    .setDescription(`**${sourceCards[0].playerName}**`)
    .addFields(
      {
        name: "Materials",
        value: sourceCards
          .map((card) => `\`!${card.publicCardId}\` Lv.${card.cardLevel}`)
          .join(" + "),
      },
      {
        name: "Result",
        value: `Card \`!${resultCard.publicCardId}\` · Lv.${resultCard.cardLevel}`,
      },
    );
}

export function createLevelUpEmbed({
  card,
  previousLevel,
  newLevel,
  itemName,
  remainingItems,
}) {
  return createUiEmbed({ title: "UPGRADE COMPLETE", color: UI_COLORS.success })
    .setDescription(`**${card.playerName}**`)
    .addFields(
      { name: "Level", value: `${previousLevel} → ${newLevel}`, inline: true },
      { name: itemName, value: `${remainingItems} remaining`, inline: true },
    )
    .setFooter({ text: `Card !${card.publicCardId}` });
}
