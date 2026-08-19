import { createUiEmbed } from "../ui/presentation.js";
import { codeTable } from "../ui/text-table.js";
import { UI_COLORS } from "../ui/theme.js";

function formatProbability(probabilityPercent) {
  const decimals = probabilityPercent < 0.001 ? 5 : 4;
  return `${probabilityPercent.toFixed(decimals)}%`;
}

export function createOddsEmbed(result) {
  return createUiEmbed({
    title: `${result.displayName.toUpperCase()} ODDS`,
    color: UI_COLORS.secondary,
  }).setDescription(codeTable([
    { label: "RARITY", width: 14 },
    { label: "ODDS", width: 11, align: "right" },
  ], result.odds.map((entry) => [
    entry.name,
    formatProbability(entry.probabilityPercent),
  ])));
}
