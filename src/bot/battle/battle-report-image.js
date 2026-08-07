const WIDTH = 824;
const HEIGHT = 1_024;
const TEAM_ONE_COLOR = "#f59e0b";
const TEAM_TWO_COLOR = "#3b82f6";
let sharpModule;

async function getSharp() {
  if (!sharpModule) {
    sharpModule = import("sharp").then((module) => module.default);
  }
  return sharpModule;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function truncate(value, maximum) {
  const normalized = String(value).trim();
  if (normalized.length <= maximum) return normalized;
  return `${normalized.slice(0, Math.max(0, maximum - 3)).trimEnd()}...`;
}

function getTeams(result) {
  const playerTeam = result.teams.find((team) => team.teamNumber === 1);
  const aiTeam = result.teams.find((team) => team.teamNumber === 2);
  if (!playerTeam || !aiTeam) {
    throw new TypeError("Battle report requires Team 1 and Team 2 results.");
  }
  return { playerTeam, aiTeam };
}

function snapshotFor(result, teamNumber, slot) {
  const lineup = teamNumber === 1
    ? result.match.inputSnapshot?.playerTeam
    : result.match.inputSnapshot?.aiTeam;
  return lineup?.find((player) => player.slot === slot);
}

function playerLabel(result, team, player) {
  const rarity = snapshotFor(result, team.teamNumber, player.slot)?.rarityName;
  const suffix = rarity ? ` (${rarity})` : "";
  const nameLength = Math.max(8, 29 - suffix.length);
  return `${truncate(player.cardName, nameLength)}${suffix}`;
}

function totals(team) {
  return team.players.reduce((total, player) => ({
    points: total.points + player.points,
    rebounds: total.rebounds + player.rebounds,
    assists: total.assists + player.assists,
    steals: total.steals + player.steals,
    blocks: total.blocks + player.blocks,
    turnovers: total.turnovers + player.turnovers,
    fieldGoalsMade: total.fieldGoalsMade + player.fieldGoalsMade,
    fieldGoalsAttempted: total.fieldGoalsAttempted + player.fieldGoalsAttempted,
    threePointersMade: total.threePointersMade + player.threePointersMade,
    threePointersAttempted:
      total.threePointersAttempted + player.threePointersAttempted,
  }), {
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
  });
}

function statCells(player, y, { total = false } = {}) {
  const values = [
    player.points,
    player.rebounds,
    player.assists,
    player.steals,
    player.blocks,
    player.turnovers,
    `${player.fieldGoalsMade}/${player.fieldGoalsAttempted}`,
    `${player.threePointersMade}/${player.threePointersAttempted}`,
  ];
  const xPositions = [322, 375, 425, 475, 525, 575, 640, 725];
  return values.map((value, index) =>
    `<text x="${xPositions[index]}" y="${y}" text-anchor="middle" ` +
    `class="${total || index === 0 ? "stat-accent" : "stat"}">${escapeXml(value)}</text>`,
  ).join("");
}

function teamTable(result, team, { y, color, title }) {
  const headerHeight = 40;
  const columnsHeight = 36;
  const rowHeight = 36;
  const totalHeight = 40;
  const tableHeight = headerHeight + columnsHeight + rowHeight * 5 + totalHeight;
  const columnLabels = [
    [58, "PLAYER", "start"], [322, "PTS"], [375, "REB"], [425, "AST"],
    [475, "STL"], [525, "BLK"], [575, "TOV"], [640, "FG"], [725, "3PT"],
  ].map(([x, label, anchor = "middle"]) =>
    `<text x="${x}" y="${y + 64}" text-anchor="${anchor}" class="column">${label}</text>`,
  ).join("");
  const rows = team.players.slice(0, 5).map((player, index) => {
    const rowY = y + headerHeight + columnsHeight + index * rowHeight;
    const textY = rowY + 24;
    return `
      <rect x="42" y="${rowY}" width="740" height="${rowHeight}"
        fill="${index % 2 === 0 ? "#1d252d" : "#151c23"}"/>
      <text x="58" y="${textY}" class="player">${escapeXml(playerLabel(result, team, player))}</text>
      ${statCells(player, textY)}
    `;
  }).join("");
  const teamTotals = totals(team);
  const totalY = y + headerHeight + columnsHeight + rowHeight * 5;
  return `
    <g>
      <rect x="42" y="${y}" width="740" height="${tableHeight}" rx="3" fill="#111820"/>
      <rect x="42" y="${y}" width="9" height="${headerHeight}" fill="${color}"/>
      <rect x="51" y="${y}" width="731" height="${headerHeight}" fill="#28313b"/>
      <text x="60" y="${y + 27}" class="team-title" fill="${color}">${escapeXml(truncate(title, 52))}</text>
      <rect x="42" y="${y + headerHeight}" width="740" height="${columnsHeight}" fill="#111820"/>
      ${columnLabels}
      ${rows}
      <rect x="42" y="${totalY}" width="740" height="${totalHeight}" fill="#293225"/>
      <text x="58" y="${totalY + 27}" class="total-label">TOTAL</text>
      ${statCells(teamTotals, totalY + 27, { total: true })}
    </g>
  `;
}

function createReportSvg(result, ownerDisplayName) {
  const { playerTeam, aiTeam } = getTeams(result);
  const ownerName = truncate(ownerDisplayName, 25);
  const scoreOwner = truncate(ownerDisplayName, 18);
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
      <style>
        text { font-family: Arial, "DejaVu Sans", sans-serif; }
        .title { fill: #f8fafc; font-size: 34px; font-weight: 800; letter-spacing: 1px; }
        .subtitle { fill: #aeb8c4; font-size: 18px; font-weight: 600; }
        .score-name { font-size: 19px; font-weight: 700; }
        .score { font-size: 55px; font-weight: 800; }
        .team-title { font-size: 18px; font-weight: 800; }
        .column { fill: #9aa5b1; font-size: 15px; font-weight: 800; }
        .player { fill: #e5e7eb; font-size: 16px; font-weight: 600; }
        .stat { fill: #d1d5db; font-size: 17px; font-weight: 600; }
        .stat-accent { fill: #facc15; font-size: 17px; font-weight: 800; }
        .total-label { fill: #e5e7eb; font-size: 17px; font-weight: 800; }
        .brand-small { fill: #9aa5b1; font-size: 16px; }
        .brand { fill: #f8fafc; font-size: 24px; font-weight: 800; letter-spacing: 1px; }
      </style>
      <rect width="824" height="1024" fill="#151c24"/>
      <path d="M0 0H824V105L665 137H0Z" fill="#232c36" opacity="0.7"/>
      <rect x="32" y="32" width="760" height="960" rx="7" fill="#1b232c" stroke="#495563" stroke-width="2"/>
      <text x="58" y="78" class="title">GAME STATS</text>
      <text x="58" y="116" class="subtitle">${escapeXml(ownerName)} vs AI Challenge</text>

      <rect x="58" y="142" width="708" height="70" rx="8" fill="#0d1319"/>
      <text x="84" y="186" class="score-name" fill="${TEAM_ONE_COLOR}">${escapeXml(scoreOwner)}</text>
      <text x="354" y="195" class="score" fill="#facc15">${playerTeam.finalScore}</text>
      <text x="411" y="184" class="subtitle">-</text>
      <text x="440" y="195" class="score" fill="#60a5fa">${aiTeam.finalScore}</text>
      <text x="512" y="186" class="score-name" fill="${TEAM_TWO_COLOR}">AI Challenge</text>

      ${teamTable(result, playerTeam, {
        y: 232,
        color: TEAM_ONE_COLOR,
        title: `TEAM 1 - ${ownerName}`,
      })}
      ${teamTable(result, aiTeam, {
        y: 568,
        color: TEAM_TWO_COLOR,
        title: "TEAM 2 - AI Challenge",
      })}

      <line x1="58" y1="918" x2="766" y2="918" stroke="#374151"/>
      <text x="412" y="952" text-anchor="middle" class="brand-small">Build your dream team on Discord</text>
      <text x="412" y="982" text-anchor="middle" class="brand">SLAMDUNK BOT</text>
    </svg>
  `;
}

export async function createBattleReportImage(
  result,
  { ownerDisplayName = "Your Team" } = {},
) {
  const sharp = await getSharp();
  return sharp(Buffer.from(createReportSvg(result, ownerDisplayName)))
    .png({ compressionLevel: 9 })
    .toBuffer();
}
