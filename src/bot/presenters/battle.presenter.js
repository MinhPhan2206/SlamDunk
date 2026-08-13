import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import { createBattleTimeline } from "../battle/battle-timeline.js";
import { UI_COLORS } from "../ui/theme.js";

const TEAM_ONE_COLOR = UI_COLORS.primary;
const TEAM_TWO_COLOR = UI_COLORS.secondary;
const TIE_COLOR = UI_COLORS.tie;
const MATCHUP_IMAGE_NAME = "battle-matchup.png";

export function createBattleRewardSummary(result) {
  if (!result.reward) return null;
  const outcome = result.reward.won ? "Victory" : "Defeat";
  const streak = result.reward.won
    ? ` • ${result.reward.winStreakAfter} Win Streak`
    : " • Win Streak Reset";
  return `**${outcome}** • +${Number(result.reward.rewardGold).toLocaleString("en-US")} Gold • +${Number(result.reward.rewardXp ?? 0).toLocaleString("en-US")} XP • ${result.reward.bracketName}${streak}`;
}

function signedGold(value) {
  const amount = Number(value);
  const sign = amount >= 0 ? "+" : "-";
  return `${sign} ${Math.abs(amount).toLocaleString("en-US")}`;
}

function breakdownLine(label, value) {
  return `${label.slice(0, 25).padEnd(25)}${signedGold(value).padStart(10)}`;
}

export function createBattleRewardBreakdownEmbed(
  result,
  { ownerDisplayName = "Your Team" } = {},
) {
  const reward = result.reward;
  if (!reward) return null;
  const playerScore = result.teams.find((team) => team.teamNumber === 1).finalScore;
  const opponentScore = result.teams.find((team) => team.teamNumber === 2).finalScore;
  const scoreMargin = playerScore - opponentScore;
  const bracketMultiplier = (
    reward.bracketMultiplierBasisPoints / 10_000
  ).toFixed(2);
  const streakPercent = reward.streakBonusBasisPoints / 100;
  const scoreFactor = reward.won ? scoreMargin : playerScore;
  const scoreRate = scoreFactor > 0 ? reward.scoreBonusGold / scoreFactor : 0;
  const rows = [
    breakdownLine(
      reward.won ? "Victory Base" : "Defeat Base",
      reward.fixedBaseGold,
    ),
    breakdownLine(
      reward.won
        ? `Score Margin (${scoreMargin} x ${scoreRate})`
        : `Points Scored (${playerScore} x ${scoreRate})`,
      reward.scoreBonusGold,
    ),
    breakdownLine(
      `${reward.bracketName} Bracket (x${bracketMultiplier})`,
      reward.bracketAdjustmentGold,
    ),
    ...(reward.won
      ? [breakdownLine(
        `Win Streak (${reward.winStreakAfter} Wins)`,
        reward.streakBonusGold,
      )]
      : []),
    "-".repeat(35),
    breakdownLine(
      reward.won ? "Total Winnings" : "Total Earnings",
      reward.rewardGold,
    ),
  ];
  return new EmbedBuilder()
    .setColor(reward.won ? UI_COLORS.success : UI_COLORS.danger)
    .setTitle(
      `${truncate(String(ownerDisplayName), 70)} · ${reward.won ? "Battle Winnings" : "Battle Compensation"}`,
    )
    .setDescription(`**Gold Breakdown 🪙**\n\`\`\`text\n${rows.join("\n")}\n\`\`\``)
    .addFields({
      name: "🔥 Current Win Streak",
      value: reward.won
        ? `**${reward.winStreakAfter} Wins** · **+${streakPercent}% Reward**`
        : "**Reset to 0**",
    }, {
      name: "⭐ Experience",
      value: `**+${Number(reward.rewardXp ?? 0).toLocaleString("en-US")} XP**` +
        (reward.leveledUp ? ` · **Level ${reward.playerLevelAfter} reached!**` : ""),
    });
}

function publicMatchId(result) {
  const matchId = result.match.publicMatchId;
  if (typeof matchId !== "string" || !/^[0-9a-f]{32}$/.test(matchId)) {
    throw new TypeError("Battle result requires a valid public Match ID.");
  }
  return matchId;
}

function truncate(value, maximum) {
  return value.length > maximum ? `${value.slice(0, maximum - 3)}...` : value;
}

function leadingTeamColor(score) {
  if (score[1] > score[2]) return TEAM_ONE_COLOR;
  if (score[2] > score[1]) return TEAM_TWO_COLOR;
  return TIE_COLOR;
}

function snapshotLineup(result, teamNumber) {
  const snapshot = teamNumber === 1
    ? result.match.inputSnapshot?.playerTeam
    : result.match.inputSnapshot?.aiTeam;
  return snapshot?.length
    ? snapshot
    : result.teams.find((team) => team.teamNumber === teamNumber).players;
}

function playLines(lines, emptyText) {
  if (!lines.length) return emptyText;
  return truncate(
    lines.map((line) => line.description).join("\n\n"),
    1_024,
  );
}

function blankLivePlayer(player) {
  return {
    slot: player.slot,
    cardName: player.cardName,
    points: 0,
    rebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    fieldGoalsMade: 0,
    fieldGoalsAttempted: 0,
    threePointersMade: 0,
    threePointersAttempted: 0,
  };
}

function findLivePlayer(team, reference) {
  if (!reference) return null;
  return team.find((player) =>
    player.slot === reference.slot && player.cardName === reference.cardName
  ) ?? null;
}

function liveBoxScore(result, events) {
  const teams = {
    1: snapshotLineup(result, 1).map(blankLivePlayer),
    2: snapshotLineup(result, 2).map(blankLivePlayer),
  };

  for (const event of events) {
    const offense = teams[event.offenseTeam];
    const defense = teams[event.offenseTeam === 1 ? 2 : 1];
    if (event.action === "TURNOVER") {
      const handler = findLivePlayer(offense, event.handler);
      if (handler) handler.turnovers += 1;
      const stealBy = findLivePlayer(defense, event.stealBy);
      if (stealBy) stealBy.steals += 1;
      continue;
    }

    const shooter = findLivePlayer(offense, event.shooter);
    if (shooter) {
      shooter.fieldGoalsAttempted += 1;
      if (event.shotType === "THREE_POINT") {
        shooter.threePointersAttempted += 1;
      }
      if (event.result === "MAKE") {
        shooter.points += event.points;
        shooter.fieldGoalsMade += 1;
        if (event.shotType === "THREE_POINT") {
          shooter.threePointersMade += 1;
        }
      }
    }
    if (event.result === "MAKE") {
      const assister = findLivePlayer(offense, event.assister);
      if (assister) assister.assists += 1;
    }
    if (event.result === "BLOCK") {
      const blocker = findLivePlayer(defense, event.shotDefender);
      if (blocker) blocker.blocks += 1;
    }
    const rebounder = event.reboundTeam
      ? findLivePlayer(teams[event.reboundTeam], event.rebounder)
      : null;
    if (rebounder) rebounder.rebounds += 1;
  }
  return teams;
}

function liveTeamLines(players) {
  const rows = players.map((player) =>
    `${player.slot.padEnd(3)} ${shortName(player.cardName).padEnd(16)} ` +
    `${String(player.points).padStart(3)} ${String(player.rebounds).padStart(3)} ` +
    String(player.assists).padStart(3),
  );
  return `\`\`\`text\nPOS PLAYER            PTS REB AST\n${rows.join("\n")}\n\`\`\``;
}

function shortName(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return truncate(parts[0], 16);
  return truncate(`${parts[0][0]}. ${parts.at(-1)}`, 16);
}

function completedEvents(result, timeline, revealedLines) {
  const completedIndexes = new Set(
    timeline.slice(0, revealedLines)
      .filter((line) => line.completesPossession)
      .map((line) => line.eventIndex),
  );
  return result.match.playByPlay.filter((event, index) => completedIndexes.has(index));
}

function createGameEmbeds(
  result,
  {
    ownerDisplayName,
    timeline,
    revealedLines,
    tickMilliseconds,
    hasMatchupImage = false,
    completed = false,
    simulated = false,
  },
) {
  const visibleLines = timeline.slice(0, revealedLines);
  const lastLine = visibleLines.at(-1);
  const score = lastLine?.score ?? { 1: 0, 2: 0 };
  const liveStats = liveBoxScore(
    result,
    completedEvents(result, timeline, revealedLines),
  );
  const lineupEmbed = new EmbedBuilder()
    .setColor(leadingTeamColor(score))
    .setTitle("Your Matchup");
  if (hasMatchupImage) {
    lineupEmbed.setImage(`attachment://${MATCHUP_IMAGE_NAME}`);
  }
  const gameEmbed = new EmbedBuilder()
    .setColor(leadingTeamColor(score))
    .setTitle(`Game · ${ownerDisplayName} vs AI Challenge`)
    .setDescription(
      playLines(visibleLines.slice(-9), "Tip-off is about to begin..."),
    )
    .addFields(
      {
        name: "TOTAL SCORE",
        value: `🏀 **[ ${ownerDisplayName} ${score[1]}  -  ${score[2]} AI Challenge ]**`,
      },
      {
        name: `🔸 TEAM 1 · ${ownerDisplayName}`,
        value: liveTeamLines(liveStats[1]),
      },
      {
        name: "🔹 TEAM 2 · AI Challenge",
        value: liveTeamLines(liveStats[2]),
      },
    );
  if (completed) {
    gameEmbed.setFooter({
      text: `Game complete${simulated ? " (simulated)" : ""} - GAME STATS sent separately`,
    });
  }
  return [lineupEmbed, gameEmbed];
}

export function createBattleLivePayload(
  result,
  {
    ownerDiscordUserId,
    ownerDisplayName = "Your Team",
    timeline = createBattleTimeline(result.match.playByPlay),
    revealedLines = 0,
    tickMilliseconds = 2_000,
    simulateDisabled = false,
    hasMatchupImage = false,
  },
) {
  const matchId = publicMatchId(result);
  const button = new ButtonBuilder()
    .setCustomId(`battle:simulate:${matchId}:${ownerDiscordUserId}`)
    .setLabel("Simulate")
    .setStyle(ButtonStyle.Primary)
    .setDisabled(simulateDisabled);
  return {
    content: `\`${matchId}\``,
    embeds: createGameEmbeds(result, {
      ownerDisplayName,
      timeline,
      revealedLines,
      tickMilliseconds,
      hasMatchupImage,
    }),
    components: [new ActionRowBuilder().addComponents(button)],
  };
}

export function createBattleGameCompletePayload(
  result,
  {
    simulated = false,
    ownerDisplayName = "Your Team",
    timeline = createBattleTimeline(result.match.playByPlay),
    tickMilliseconds = 2_000,
    hasMatchupImage = false,
  } = {},
) {
  return {
    content: `\`${publicMatchId(result)}\``,
    embeds: createGameEmbeds(result, {
      ownerDisplayName,
      timeline,
      revealedLines: timeline.length,
      tickMilliseconds,
      hasMatchupImage,
      completed: true,
      simulated,
    }),
    components: [],
  };
}
