import { EmbedBuilder } from "discord.js";

const ODDS_COLOR = 0x8b5cf6;

function formatProbability(probabilityPercent) {
  return `${probabilityPercent.toFixed(4)}%`;
}

export function createOddsEmbed(result) {
  const embed = new EmbedBuilder()
    .setColor(ODDS_COLOR)
    .setTitle(`${result.displayName} Odds`)
    .setDescription(
      result.odds
        .map(
          (entry) =>
            `**${entry.name}** (Tier ${entry.rarityTier}) — ${formatProbability(entry.probabilityPercent)}`,
        )
        .join("\n"),
    );

  return embed.setFooter({
    text:
      result.source === "drop"
        ? `Per candidate roll; /drop shows ${result.candidateCount} candidates. Tiers without packable cards are excluded at roll time.`
        : `Pack code: ${result.packCode}. Additional Packs can define independent odds.`,
  });
}
