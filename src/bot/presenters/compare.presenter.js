import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} from "discord.js";

import { formatPositions, truncateText } from "../ui/formatters.js";
import { createCardStripImage } from "../ui/card-strip-image.js";
import { createUiEmbed } from "../ui/presentation.js";
import { compactCodeTable } from "../ui/text-table.js";
import { UI_COLORS } from "../ui/theme.js";

const COMPARE_IMAGE_NAME = "card-comparison.png";
const STATS = Object.freeze([
  ["3 Point", "threePoint"],
  ["Mid Range", "midRange"],
  ["Finishing", "finishing"],
  ["Playmaking", "playmaking"],
  ["Interior DEF", "interiorDefense"],
  ["Perimeter DEF", "perimeterDefense"],
  ["Strength", "strength"],
]);
const TRAIT_GROUPS = Object.freeze([
  ["OFFENSE", new Set(["OFFENSE", "SHOOTING", "FINISHING", "CREATION", "TRANSITION"])],
  ["PLAYMAKING", new Set(["PLAYMAKING"])],
  ["DEFENSE", new Set(["DEFENSE"])],
  ["PHYSICAL", new Set(["PHYSICAL", "REBOUNDING"])],
  ["SITUATIONAL", new Set(["SITUATIONAL", "CLUTCH"])],
]);

function entityId(side) {
  return side.mode === "instance" ? side.card.cardInstanceId : side.card.cardTemplateId;
}

function level(side) {
  return side.mode === "instance" ? side.card.cardLevel : 5;
}

function header(side, label) {
  const cardId = side.mode === "instance" ? ` · \`!${side.card.publicCardId}\`` : " · Template";
  return `**${label} · ${side.card.playerName}**\n` +
    `${side.card.rarityName} · ${formatPositions(side.card)} · Lv.${level(side)}${cardId}`;
}

function statsTable(a, b) {
  const aStats = a.card.actualStats ?? a.card;
  const bStats = b.card.actualStats ?? b.card;
  return compactCodeTable([
    { label: "STAT", width: 13 },
    { label: "A", width: 3, align: "right" },
    { label: "B", width: 3, align: "right" },
    { label: "EDGE", width: 7, align: "right" },
  ], STATS.map(([label, key]) => {
    const difference = Number(aStats[key]) - Number(bStats[key]);
    return [label, aStats[key], bStats[key], difference === 0
      ? "Even"
      : `${difference > 0 ? "A" : "B"} +${Math.abs(difference)}`];
  }));
}

function traitTable(traitsA, traitsB) {
  const byCodeA = new Map(traitsA.map((trait) => [trait.traitCode, trait]));
  const byCodeB = new Map(traitsB.map((trait) => [trait.traitCode, trait]));
  const all = [...new Map([...traitsA, ...traitsB].map((trait) => [trait.traitCode, trait])).values()];
  const sections = TRAIT_GROUPS.flatMap(([name, types]) => {
    const traits = all
      .filter((trait) => types.has(trait.traitType))
      .sort((left, right) => left.traitName.localeCompare(right.traitName));
    if (!traits.length) return [];
    return [
      `**${name}**`,
      compactCodeTable([
        { label: "TRAIT", width: 20 },
        { label: "A", width: 3, align: "right" },
        { label: "B", width: 3, align: "right" },
      ], traits.map((trait) => [
        trait.traitName,
        byCodeA.get(trait.traitCode)?.traitTier ?? "-",
        byCodeB.get(trait.traitCode)?.traitTier ?? "-",
      ])),
    ];
  });
  return sections.length ? sections.join("\n") : "No Traits on either Card.";
}

function tabRow(a, b, viewerId, selectedTab) {
  const prefix = `compare:${viewerId}:${a.mode}:${entityId(a)}:${b.mode}:${entityId(b)}`;
  return new ActionRowBuilder().addComponents(
    ...[["stats", "📊"], ["traits", "✨"], ["image", "🖼️"]].map(([tab, emoji]) =>
      new ButtonBuilder()
        .setCustomId(`${prefix}:${tab}`)
        .setEmoji(emoji)
        .setStyle(tab === selectedTab ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setDisabled(tab === selectedTab),
    ),
  );
}

export function createCompareSearchPayload({ sessionId, viewerId, sides }) {
  const rows = ["a", "b"].flatMap((sideName) => {
    const side = sides[sideName];
    if (side.mode !== "search") return [];
    const select = new StringSelectMenuBuilder()
      .setCustomId(`compare:pick:${viewerId}:${sessionId}:${sideName}`)
      .setPlaceholder(`Select Card ${sideName.toUpperCase()}`)
      .addOptions(side.candidates.map((card) => ({
        label: truncateText(card.playerName, 100),
        description: truncateText(`${card.rarityName} · ${formatPositions(card)}`, 100),
        value: String(card.cardTemplateId),
      })));
    return [new ActionRowBuilder().addComponents(select)];
  });
  const status = ["a", "b"].map((name) => {
    const side = sides[name];
    return side.mode === "search"
      ? `**${name.toUpperCase()}** · Select from ${side.candidates.length} matches`
      : header(side, name.toUpperCase());
  });
  return {
    embeds: [createUiEmbed({ title: "CARD COMPARISON", color: UI_COLORS.primary })
      .setDescription(status.join("\n\n"))],
    components: rows,
  };
}

export async function createComparePayload({
  a,
  b,
  viewerId,
  selectedTab = "stats",
  traitsA = [],
  traitsB = [],
}) {
  const embed = createUiEmbed({ title: "CARD COMPARISON", color: UI_COLORS.primary });
  if (selectedTab === "image") {
    embed.setImage(`attachment://${COMPARE_IMAGE_NAME}`);
  } else {
    embed.setDescription([
      header(a, "A"),
      "",
      header(b, "B"),
      "",
      selectedTab === "stats" ? statsTable(a, b) : traitTable(traitsA, traitsB),
    ].join("\n"));
    if (selectedTab === "stats") embed.setImage(`attachment://${COMPARE_IMAGE_NAME}`);
  }
  const payload = {
    embeds: [embed],
    components: [tabRow(a, b, viewerId, selectedTab)],
    attachments: [],
  };
  if (["stats", "image"].includes(selectedTab)) {
    payload.files = [{
      attachment: await createCardStripImage([a.card, b.card], { labels: ["A", "B"] }),
      name: COMPARE_IMAGE_NAME,
    }];
  }
  return payload;
}
