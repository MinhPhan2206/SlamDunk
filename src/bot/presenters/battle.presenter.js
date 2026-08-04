import { EmbedBuilder } from "discord.js";

const WIN_COLOR = 0x2ecc71;
const LOSS_COLOR = 0xe74c3c;

function teamBoxScore(team) {
  return team.players
    .map(
      (player) =>
        `${player.slot} — ${player.cardName} (Lv${player.cardLevel}): **${player.points} PTS**`,
    )
    .join("\n");
}

export function createBattleEmbed(result) {
  const playerTeam = result.teams.find((team) => team.teamNumber === 1);
  const aiTeam = result.teams.find((team) => team.teamNumber === 2);
  const won = result.match.winnerTeam === 1;

  return new EmbedBuilder()
    .setColor(won ? WIN_COLOR : LOSS_COLOR)
    .setTitle(won ? "Victory!" : "Defeat")
    .setDescription(
      `**${playerTeam.teamName} ${playerTeam.finalScore} — ${aiTeam.finalScore} ${aiTeam.teamName}**`,
    )
    .addFields(
      { name: playerTeam.teamName, value: teamBoxScore(playerTeam) },
      { name: aiTeam.teamName, value: teamBoxScore(aiTeam) },
    )
    .setFooter({
      text: `Match #${result.match.matchId} • PvE simulation • No reward`,
    });
}
