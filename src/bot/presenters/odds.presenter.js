import { EmbedBuilder } from "discord.js";

const ODDS_COLOR = 0x8b5cf6;

function formatProbability(probabilityPercent) {
  return `${probabilityPercent.toFixed(4)}%`;
}

export function createOddsEmbed(result) {
  return new EmbedBuilder()
    .setColor(ODDS_COLOR)
    .setTitle(`${result.displayName} Odds`)
    .setDescription(
      result.odds
        .map(
          (entry) =>
            `**${entry.name}** — ${formatProbability(entry.probabilityPercent)}`,
        )
        .join("\n"),
    );
}
