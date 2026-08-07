import { EmbedBuilder } from "discord.js";
import { formatNumber } from "../ui/formatters.js";
import { UI_COLORS } from "../ui/theme.js";

function winRate(player) {
  const games = Number(player.gamesPlayed);
  return games > 0 ? ((Number(player.gamesWon) / games) * 100).toFixed(1) : "0.0";
}

export function createProfileEmbed({
  player,
  wallet,
  displayName = player.usernameSnapshot,
  thumbnailUrl,
}) {
  const embed = new EmbedBuilder()
    .setColor(UI_COLORS.primary)
    .setTitle(`${displayName}'s Profile`)
    .setDescription(
      `**Level ${player.playerLevel}** • ${formatNumber(player.xp)} XP`,
    )
    .addFields(
      {
        name: "Record",
        value: `**${formatNumber(player.gamesWon)}-${formatNumber(player.gamesLost)}**\n` +
          `${winRate(player)}% Win Rate • ${formatNumber(player.gamesPlayed)} Games`,
        inline: true,
      },
      {
        name: "Wallet",
        value: `Gold: **${formatNumber(wallet.goldBalance)}**\n` +
          `Shards: **${formatNumber(wallet.shardBalance)}**`,
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
