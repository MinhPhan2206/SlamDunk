import { EmbedBuilder } from "discord.js";

const PROFILE_COLOR = 0xf28c28;

function formatWholeNumber(value) {
  return BigInt(value).toLocaleString("en-US");
}

export function createProfileEmbed({
  player,
  wallet,
  displayName = player.usernameSnapshot,
}) {
  return new EmbedBuilder()
    .setColor(PROFILE_COLOR)
    .setTitle(`${displayName}'s SlamDunk Profile`)
    .addFields(
      {
        name: "Progression",
        value: [
          `Level: **${player.playerLevel}**`,
          `XP: **${formatWholeNumber(player.xp)}**`,
        ].join("\n"),
        inline: true,
      },
      {
        name: "Record",
        value: [
          `Games: **${formatWholeNumber(player.gamesPlayed)}**`,
          `Wins: **${formatWholeNumber(player.gamesWon)}**`,
          `Losses: **${formatWholeNumber(player.gamesLost)}**`,
        ].join("\n"),
        inline: true,
      },
      {
        name: "Streaks",
        value: [
          `Current: **${formatWholeNumber(player.currentWinStreak)}**`,
          `Best: **${formatWholeNumber(player.highestWinStreak)}**`,
        ].join("\n"),
        inline: true,
      },
      {
        name: "Wallet",
        value: [
          `Gold: **${formatWholeNumber(wallet.goldBalance)}**`,
          `Shards: **${formatWholeNumber(wallet.shardBalance)}**`,
        ].join("\n"),
        inline: true,
      },
    );
}
