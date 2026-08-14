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

function ownerLabel(card) {
  if (card.ownerDiscordUserId) return `<@${card.ownerDiscordUserId}>`;
  if (card.ownerUsername) return `@${card.ownerUsername}`;
  return "No current owner";
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
    lines.push(
      `Serial · **!${card.publicCardId}**`,
      `Owned by ${ownerLabel(card)}`,
    );
  }
  return lines.join("\n");
}

const TRAIT_GROUPS = Object.freeze([
  Object.freeze({
    name: "⚔️ OFFENSE",
    types: new Set(["OFFENSE", "SHOOTING", "FINISHING", "CREATION", "TRANSITION"]),
  }),
  Object.freeze({ name: "🎯 PLAYMAKING", types: new Set(["PLAYMAKING"]) }),
  Object.freeze({ name: "🛡️ DEFENSE", types: new Set(["DEFENSE"]) }),
  Object.freeze({
    name: "💪 PHYSICAL & REBOUNDING",
    types: new Set(["PHYSICAL", "REBOUNDING"]),
  }),
  Object.freeze({
    name: "⏱️ SITUATIONAL & CLUTCH",
    types: new Set(["SITUATIONAL", "CLUTCH"]),
  }),
]);

function traitLine(trait) {
  return `• **${trait.traitName}** · **${trait.traitTierLabel ?? `Tier ${trait.traitTier}`}**`;
}

function traitFields(traits) {
  if (!traits?.length) return [{ name: "✨ TRAITS", value: "No Traits." }];
  const assigned = new Set();
  const fields = TRAIT_GROUPS.flatMap((group) => {
    const matches = traits
      .filter((trait) => group.types.has(trait.traitType))
      .sort((left, right) => left.traitName.localeCompare(right.traitName));
    matches.forEach((trait) => assigned.add(trait));
    return matches.length
      ? [{ name: group.name, value: matches.map(traitLine).join("\n"), inline: false }]
      : [];
  });
  const other = traits
    .filter((trait) => !assigned.has(trait))
    .sort((left, right) => left.traitName.localeCompare(right.traitName));
  if (other.length) {
    fields.push({ name: "✨ OTHER", value: other.map(traitLine).join("\n"), inline: false });
  }
  return fields;
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
  const lock = card.userLock ? " · 🔒 Locked" : "";
  return `**${card.playerName.toUpperCase()}**\nOwned by ${ownerLabel(card)}\n` +
    `${positions} · Level ${card.cardLevel} · \`!${card.publicCardId}\`${lock}`;
}

function addTabContent(embed, card, tab, { traits, battleStats }) {
  if (tab === "traits") {
    return embed.addFields(...traitFields(traits));
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
