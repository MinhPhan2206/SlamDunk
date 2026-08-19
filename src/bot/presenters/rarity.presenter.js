import { formatRarity } from "../../config/rarity-config.js";
import {
  createPaginationRow,
  createUiEmbed,
  pageFooter,
} from "../ui/presentation.js";
import { codeTable } from "../ui/text-table.js";
import { rarityColor } from "../ui/theme.js";

const PAGE_SIZE = 10;
const NAME_WIDTH = 22;
const POSITION_WIDTH = 5;
const STAT_WIDTH = 7;
const STAT_FIELDS = Object.freeze({
  finishing: ["FIN", "finishing"],
  mid_range: ["MID", "midRange"],
  three_point: ["3PT", "threePoint"],
  playmaking: ["PLAY", "playmaking"],
  interior_defense: ["INT DEF", "interiorDefense"],
  perimeter_defense: ["PER DEF", "perimeterDefense"],
  strength: ["STR", "strength"],
});

function positions(template) {
  return [template.primaryPosition, template.secondaryPosition]
    .filter(Boolean)
    .join("/");
}

function createTable(result) {
  const stat = STAT_FIELDS[result.sortBy];
  const columns = stat
    ? [
      { label: "#", width: 2, align: "right" },
      { label: "NAME", width: NAME_WIDTH, align: "left" },
      { label: stat[0], width: STAT_WIDTH, align: "right" },
      { label: "POS", width: POSITION_WIDTH, align: "left" },
    ]
    : [
      { label: "#", width: 2, align: "right" },
      { label: "NAME", width: NAME_WIDTH, align: "left" },
      { label: "POS", width: POSITION_WIDTH, align: "left" },
    ];
  const rows = result.templates.map((template, index) => {
    const number = (result.page - 1) * PAGE_SIZE + index + 1;
    return stat
      ? [number, template.playerName, template[stat[1]], positions(template)]
      : [number, template.playerName, positions(template)];
  });
  return codeTable(columns, rows);
}

function listDescription(result) {
  const rarityName = formatRarity(result.rarityCode);
  const position = result.position ? ` at **${result.position}**` : "";
  const sortText = result.sortBy === "alphabet"
    ? "alphabetically"
    : `by **${result.sortLabel}**`;
  return `List of **${rarityName}** cards${position}, sorted ${sortText}.`;
}

export function createRarityEmbed(
  result,
  { requesterLine = null, requesterIconUrl = null } = {},
) {
  const embed = createUiEmbed({
    color: rarityColor(result.rarityCode),
    title: "CARD RESULTS",
  });

  if (result.templates.length === 0) {
    embed.setDescription(
      `${listDescription(result)}\n\nNo Card Templates match these filters.`,
    );
  } else {
    embed.setDescription(
      `${listDescription(result)}\n\n${createTable(result)}`,
    );
  }

  const footer = {
    text: pageFooter({
      page: result.page,
      totalPages: result.totalPages,
      requesterLine,
    }),
  };
  if (requesterIconUrl) footer.iconURL = requesterIconUrl;
  return embed.setFooter(footer);
}

export function createRarityPayload(
  result,
  {
    viewerDiscordUserId,
    requesterLine = null,
    requesterIconUrl = null,
  },
) {
  const state = `${viewerDiscordUserId}:${result.rarityCode}:` +
    `${result.position ?? "ALL"}:${result.sortBy}`;
  const pagination = createPaginationRow({
    previousCustomId: `rarity-page:${state}:${result.page - 1}`,
    nextCustomId: `rarity-page:${state}:${result.page + 1}`,
    page: result.page,
    totalPages: result.totalPages,
  });
  return {
    embeds: [createRarityEmbed(result, { requesterLine, requesterIconUrl })],
    components: pagination ? [pagination] : [],
  };
}
