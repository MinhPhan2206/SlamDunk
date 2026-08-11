import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";

import { formatNumber, formatPositions } from "../ui/formatters.js";
import { readCardArt } from "../ui/card-art.js";
import { rarityColor } from "../ui/theme.js";

const CARD_IMAGE_NAME = "card.png";

function formatHeight(heightCm) {
  if (!Number.isFinite(Number(heightCm)) || Number(heightCm) <= 0) {
    return "Unknown";
  }
  const totalInches = Math.round(Number(heightCm) / 2.54);
  return `${Math.floor(totalInches / 12)}'${totalInches % 12}\"`;
}

function statLine(label, value) {
  return `${label} · **${value}**`;
}

function statsDescription(card, mode) {
  const stats = card.actualStats ?? card;
  const positions = formatPositions(card);
  const cardLevel = mode === "instance" ? card.cardLevel : 5;
  const lines = [
    `**${card.playerName.toUpperCase()}**`,
    "",
    `Position · **${positions}**`,
    `Height · **${formatHeight(card.heightCm)}**`,
    "",
    "⚔️ **OFFENSE**",
    statLine("3 Point Shooting", stats.threePoint),
    statLine("Mid Range", stats.midRange),
    statLine("Finishing", stats.finishing),
    statLine("Playmaking", stats.playmaking),
    "",
    "🛡️ **DEFENSE**",
    statLine("Interior Defense", stats.interiorDefense),
    statLine("Perimeter Defense", stats.perimeterDefense),
    "",
    "💪 **PHYSICAL**",
    statLine("Strength", stats.strength),
    "",
    `**CARD LEVEL** · **${cardLevel}**`,
    "",
    `Obtained · **${formatNumber(card.totalMinted ?? 0)}**`,
  ];
  if (mode === "instance") {
    const owner = card.ownerDiscordUserId
      ? `<@${card.ownerDiscordUserId}>`
      : card.ownerUsername
        ? `@${card.ownerUsername}`
        : "No current owner";
    lines.push(
      `Serial · **!${card.publicCardId}**`,
      `Owned by ${owner}`,
    );
  }
  return lines.join("\n");
}

function traitBlock(traits) {
  if (!traits?.length) return "No Traits.";
  return traits.map((trait) =>
    `• **${trait.traitName}** · ${trait.traitTierLabel ?? `Tier ${trait.traitTier}`}`
  ).join("\n");
}

function battleStatsBlock(stats) {
  const rows = [
    ["GP", String(stats.gamesPlayed)],
    ["PPG", stats.pointsPerGame.toFixed(1)],
    ["RPG", stats.reboundsPerGame.toFixed(1)],
    ["APG", stats.assistsPerGame.toFixed(1)],
    ["SPG", stats.stealsPerGame.toFixed(1)],
    ["BPG", stats.blocksPerGame.toFixed(1)],
    ["TOV", stats.turnoversPerGame.toFixed(1)],
    ["FG%", `${stats.fieldGoalPercentage.toFixed(1)}%`],
    ["3PT%", `${stats.threePointPercentage.toFixed(1)}%`],
  ];
  return `\`\`\`text\n${rows.map(([label, value]) =>
    `${label.padEnd(5)} ${value.padStart(6)}`
  ).join("\n")}\n\`\`\``;
}

function cardDescription(card, mode) {
  const positions = formatPositions(card).replace("/", " / ");
  if (mode === "template") {
    return `**${card.playerName.toUpperCase()}**\nCard Template\n` +
      `${positions} · Level 5`;
  }
  const owner = card.ownerUsername ? `@${card.ownerUsername}` : "No current owner";
  const lock = card.userLock ? " · 🔒 Locked" : "";
  return `**${card.playerName.toUpperCase()}**\nOwned by ${owner}\n` +
    `${positions} · Level ${card.cardLevel} · \`!${card.publicCardId}\`${lock}`;
}

function addTabContent(embed, card, tab, { traits, battleStats }) {
  if (tab === "traits") {
    return embed.addFields({ name: "Traits", value: traitBlock(traits) });
  }
  if (tab === "battle") {
    return embed.addFields({
      name: "Battle Stats",
      value: battleStatsBlock(battleStats),
    });
  }
  return embed;
}

function tabRow({ viewerDiscordUserId, mode, entityId, selectedTab }) {
  const tabs = mode === "instance"
    ? [["stats", "📊"], ["traits", "✨"], ["battle", "🏀"], ["image", "🖼️"]]
    : [["stats", "📊"], ["traits", "✨"], ["image", "🖼️"]];
  return new ActionRowBuilder().addComponents(...tabs.map(([tab, icon]) =>
    new ButtonBuilder()
      .setCustomId(`card:${viewerDiscordUserId}:${mode}:${entityId}:${tab}`)
      .setEmoji(icon)
      .setStyle(tab === selectedTab ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(tab === selectedTab)
  ));
}

export async function createCardPayload(
  card,
  {
    viewerDiscordUserId,
    mode,
    selectedTab = "stats",
    traits = [],
    battleStats = null,
  },
) {
  const entityId = mode === "instance" ? card.cardInstanceId : card.cardTemplateId;
  const embed = new EmbedBuilder().setColor(rarityColor(card.rarityCode));
  if (selectedTab === "image") {
    embed.setImage(`attachment://${CARD_IMAGE_NAME}`);
  } else {
    embed
      .setTitle(`◆ ${card.rarityName.toUpperCase()} ◆`)
      .setDescription(
        selectedTab === "stats"
          ? statsDescription(card, mode)
          : cardDescription(card, mode),
      );
    if (selectedTab === "stats") {
      embed.setThumbnail(`attachment://${CARD_IMAGE_NAME}`);
    }
  }
  addTabContent(embed, card, selectedTab, { traits, battleStats });
  const payload = {
    embeds: [embed],
    components: [tabRow({
      viewerDiscordUserId,
      mode,
      entityId,
      selectedTab,
    })],
  };
  if (["image", "stats"].includes(selectedTab)) {
    payload.attachments = [];
    payload.files = [{ attachment: await readCardArt(card), name: CARD_IMAGE_NAME }];
  } else {
    payload.attachments = [];
  }
  return payload;
}
