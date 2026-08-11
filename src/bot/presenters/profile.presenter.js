import { EmbedBuilder } from "discord.js";
import { formatNumber } from "../ui/formatters.js";
import { UI_COLORS } from "../ui/theme.js";

export function createProfileEmbed({
  player,
  displayName = player.usernameSnapshot,
  thumbnailUrl,
}) {
  const embed = new EmbedBuilder()
    .setColor(UI_COLORS.primary)
    .setTitle(`${displayName}'s Profile`)
    .setDescription(
      `**Level ${player.playerLevel}** · ${formatNumber(player.xp)} XP`,
    )
    .addFields(
      {
        name: "Record",
        value: `W-L: **${formatNumber(player.gamesWon)}-${formatNumber(player.gamesLost)}**\n` +
          `Total Games: **${formatNumber(player.gamesPlayed)}**`,
        inline: true,
      },
      {
        name: "Win Streak",
        value: `Current: **${formatNumber(player.currentWinStreak)}**\n` +
          `Best: **${formatNumber(player.highestWinStreak)}**`,
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
