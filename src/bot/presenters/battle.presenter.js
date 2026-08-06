import { EmbedBuilder } from "discord.js";

const WIN_COLOR = 0x2ecc71;
const LOSS_COLOR = 0xe74c3c;

function teamBoxScore(team) {
  return team.players
    .map(
      (player) =>
        `${player.slot} — ${player.cardName.slice(0, 22)} (Lv${player.cardLevel}) | ` +
        `**${player.points}P** ${player.rebounds}R ${player.assists}A ` +
        `${player.steals}S ${player.blocks}B ${player.turnovers}T | ` +
        `FG ${player.fieldGoalsMade}/${player.fieldGoalsAttempted} | ` +
        `3PT ${player.threePointersMade}/${player.threePointersAttempted}`,
    )
    .join("\n");
}

function recentPlays(playByPlay) {
  const plays = playByPlay.slice(-5).map((event) =>
    `#${event.possession} ${event.description}`,
  );
  const text = plays.join("\n");
  return text.length > 1_024 ? `${text.slice(0, 1_021)}...` : text;
}

export function createBattleEmbed(result) {
  const playerTeam = result.teams.find((team) => team.teamNumber === 1);
  const aiTeam = result.teams.find((team) => team.teamNumber === 2);
  const won = result.match.winnerTeam === 1;

  return new EmbedBuilder()
    .setColor(won ? WIN_COLOR : LOSS_COLOR)
    .setTitle(won ? "Victory!" : "Defeat")
    .setDescription(
      `First to 21 · **${playerTeam.teamName} ${playerTeam.finalScore} — ${aiTeam.finalScore} ${aiTeam.teamName}**`,
    )
    .addFields(
      { name: playerTeam.teamName, value: teamBoxScore(playerTeam) },
      { name: aiTeam.teamName, value: teamBoxScore(aiTeam) },
      {
        name: "Recent Plays",
        value: recentPlays(result.match.playByPlay),
      },
    )
    .setFooter({
      text: `Match #${result.match.matchId} · Engine ${result.match.engineVersion} · ${result.match.possessionCount} possessions · No reward`,
    });
}
