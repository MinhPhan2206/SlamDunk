import { formatRarity } from "../../config/rarity-config.js";
import {
  createPaginationRow,
  createUiEmbed,
  pageFooter,
} from "../ui/presentation.js";
import { formatCompactPlayerName } from "../ui/player-name.js";
import { compactCodeTable } from "../ui/text-table.js";
import { UI_COLORS } from "../ui/theme.js";

const COLUMNS = Object.freeze([
  { label: "#", width: 2, align: "right" },
  { label: "PLAYER", width: 15, align: "left" },
  { label: "RARITY", width: 9, align: "left" },
  { label: "POS", width: 5, align: "left" },
  { label: "LV", width: 2, align: "right" },
  { label: "CARD ID", width: 10, align: "right" },
  { label: "L", width: 1, align: "left" },
]);

function positions(card) {
  return [card.primaryPosition, card.secondaryPosition]
    .filter(Boolean)
    .join("/");
}

function collectionRows(cards) {
  return cards.map((card) => [
    card.collectionPosition,
    formatCompactPlayerName(card.playerName),
    formatRarity(card.rarityCode),
    positions(card),
    card.cardLevel,
    `!${card.publicCardId}`,
    card.userLock ? "Y" : "—",
  ]);
}

export function createCollectionEmbed(
  result,
  {
    title = "Your Collection",
    requesterLine = null,
    requesterIconUrl = null,
  } = {},
) {
  const embed = createUiEmbed({ title: title.toUpperCase(), color: UI_COLORS.primary })
    .setDescription(
      result.cards.length === 0
        ? (title === "Your Collection"
          ? "No active Cards yet. Use `/drop` or `/pack` to get started."
          : "This Player does not own any active Cards yet.")
        : `Sorted by **${result.sortLabel}**.\n\n${compactCodeTable(COLUMNS, collectionRows(result.cards))}`,
    )
    .setFooter({
      text: pageFooter({
        page: result.page,
        totalPages: result.totalPages,
        requesterLine,
      }),
      ...(requesterIconUrl ? { iconURL: requesterIconUrl } : {}),
    });
  return embed;
}

export function createCollectionPayload(
  result,
  {
    discordUserId,
    playerId,
    title = "Your Collection",
    requesterLine = null,
    requesterIconUrl = null,
  },
) {
  const pagination = createPaginationRow({
    previousCustomId: `collection-page:${discordUserId}:${playerId}:${result.page - 1}`,
    nextCustomId: `collection-page:${discordUserId}:${playerId}:${result.page + 1}`,
    page: result.page,
    totalPages: result.totalPages,
  });
  return {
    embeds: [createCollectionEmbed(result, {
      title,
      requesterLine,
      requesterIconUrl,
    })],
    components: pagination ? [pagination] : [],
  };
}
