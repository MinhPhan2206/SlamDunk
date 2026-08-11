import { EmbedBuilder } from "discord.js";
import { UI_COLORS } from "../ui/theme.js";

function formatProbability(probabilityPercent) {
  const decimals = probabilityPercent < 0.001 ? 5 : 4;
  return `${probabilityPercent.toFixed(decimals)}%`;
}

export function createOddsEmbed(result) {
  return new EmbedBuilder()
    .setColor(UI_COLORS.secondary)
    .setTitle(`${result.displayName} Odds`)
    .setDescription(
      `\`\`\`text\n${"RARITY".padEnd(14)}${"ODDS".padStart(10)}\n` +
      `${"-".repeat(24)}\n` +
      result.odds.map((entry) =>
        `${entry.name.padEnd(14)}${formatProbability(entry.probabilityPercent).padStart(10)}`
      ).join("\n") + "\n```",
    );
}
