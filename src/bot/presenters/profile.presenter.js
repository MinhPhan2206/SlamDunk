import { getPlayerLevelProgress } from "../../modules/player/index.js";
import { formatNumber } from "../ui/formatters.js";
import { createUiEmbed } from "../ui/presentation.js";
import { UI_COLORS } from "../ui/theme.js";

function progressBar(current, required, width = 10) {
  if (required <= 0) return "█".repeat(width);
  const filled = Math.max(0, Math.min(width, Math.round((current / required) * width)));
  return `${"█".repeat(filled)}${"░".repeat(width - filled)}`;
}

export function createProfileEmbed({
  player,
  displayName = player.usernameSnapshot,
  thumbnailUrl,
}) {
  const progress = getPlayerLevelProgress(player.xp);
  const embed = createUiEmbed({ title: "PLAYER PROFILE", color: UI_COLORS.primary })
    .setAuthor({ name: displayName })
    .setDescription(
      `**LEVEL ${progress.playerLevel}**\n` +
      `\`${progressBar(progress.xpIntoLevel, progress.xpRequired)}\` ` +
      `${formatNumber(progress.xpIntoLevel)} / ${formatNumber(progress.xpRequired)} XP`,
    )
    .addFields(
      {
        name: "RECORD",
        value: `W-L · **${formatNumber(player.gamesWon)}-${formatNumber(player.gamesLost)}**\n` +
          `Total Games · **${formatNumber(player.gamesPlayed)}**`,
        inline: true,
      },
      {
        name: "WIN STREAK",
        value: `Current · **${formatNumber(player.currentWinStreak)}**\n` +
          `Best · **${formatNumber(player.highestWinStreak)}**`,
        inline: true,
      },
    );
  if (thumbnailUrl) embed.setThumbnail(thumbnailUrl);
  if (player.createdAt) {
    embed.setFooter({
      text: `Playing since ${new Date(player.createdAt).toLocaleDateString("en-US")}`,
    });
  }
  return embed;
}
