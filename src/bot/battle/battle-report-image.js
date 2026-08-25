import { readCardArt } from "../ui/card-art.js";
import { renderImage } from "../ui/image-runtime.js";
import { colorHex, rarityColor } from "../ui/theme.js";

const WIDTH = 1_200;
const HEIGHT = 1_400;
const TEAM_ONE_COLOR = "#f59e0b";
const TEAM_TWO_COLOR = "#3b82f6";
const SLOT_ORDER = Object.freeze(["PG", "SG", "SF", "PF", "C"]);

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
  return normalized.length <= maximum
    ? normalized
    : `${normalized.slice(0, maximum - 3).trimEnd()}...`;
}

function percentage(made, attempted) {
  return attempted > 0 ? `${((made / attempted) * 100).toFixed(1)}%` : "0.0%";
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
  return lineup?.find((player) => player.slot === slot) ?? {};
}

function enrichPlayer(result, team, player) {
  const snapshot = snapshotFor(result, team.teamNumber, player.slot);
  return Object.freeze({
    ...player,
    teamNumber: team.teamNumber,
    teamWon: team.finalScore > result.teams.find(
      (entry) => entry.teamNumber !== team.teamNumber,
    ).finalScore,
    rarityCode: snapshot.rarityCode ?? "BASE",
    rarityName: snapshot.rarityName ?? "Base",
    primaryPosition: snapshot.primaryPosition ?? player.slot,
    secondaryPosition: snapshot.secondaryPosition ?? null,
    cardLevel: snapshot.cardLevel ?? player.cardLevel,
  });
}

function efficiency(player) {
  return player.fieldGoalsAttempted > 0
    ? player.fieldGoalsMade / player.fieldGoalsAttempted
    : 0;
}

export function calculateMvpScore(player) {
  return player.points + player.rebounds * 1.2 + player.assists * 1.5 +
    player.steals * 2 + player.blocks * 2 - player.turnovers * 1.5;
}

function compareMvp(left, right) {
  return calculateMvpScore(right) - calculateMvpScore(left) ||
    right.points - left.points ||
    efficiency(right) - efficiency(left) ||
    left.turnovers - right.turnovers ||
    SLOT_ORDER.indexOf(left.slot) - SLOT_ORDER.indexOf(right.slot);
}

export function selectGameMvp(result) {
  const { playerTeam, aiTeam } = getTeams(result);
  const winningTeam = playerTeam.finalScore >= aiTeam.finalScore
    ? playerTeam
    : aiTeam;
  return [...winningTeam.players]
    .map((player) => enrichPlayer(result, winningTeam, player))
    .sort(compareMvp)[0];
}

function compareLeader(metric) {
  return (left, right) => metric(right) - metric(left) ||
    left.turnovers - right.turnovers ||
    Number(right.teamWon) - Number(left.teamWon) ||
    compareMvp(left, right);
}

export function selectGameLeaders(result) {
  const { playerTeam, aiTeam } = getTeams(result);
  const players = [playerTeam, aiTeam].flatMap((team) =>
    team.players.map((player) => enrichPlayer(result, team, player))
  );
  const leader = (metric) => [...players].sort(compareLeader(metric))[0];
  return Object.freeze({
    scoring: leader((player) => player.points),
    rebounding: leader((player) => player.rebounds),
    playmaking: leader((player) => player.assists),
    defense: leader((player) => player.steals + player.blocks),
  });
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
    threePointersAttempted: total.threePointersAttempted + player.threePointersAttempted,
  }), {
    points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0,
    fieldGoalsMade: 0, fieldGoalsAttempted: 0,
    threePointersMade: 0, threePointersAttempted: 0,
  });
}

function rarityBadge(player, x, y) {
  const color = colorHex(rarityColor(player.rarityCode));
  const label = truncate(player.rarityName.toUpperCase(), 11);
  const width = Math.max(68, label.length * 8 + 18);
  return `
    <rect x="${x}" y="${y - 18}" width="${width}" height="24" rx="5"
      fill="${color}" fill-opacity="0.18" stroke="${color}"/>
    <text x="${x + width / 2}" y="${y}" text-anchor="middle"
      class="badge" fill="${color}">${escapeXml(label)}</text>`;
}

function statCells(player, y, { total = false, color }) {
  const values = [
    player.points, player.rebounds, player.assists, player.steals,
    player.blocks, player.turnovers,
    `${player.fieldGoalsMade}/${player.fieldGoalsAttempted}`,
    `${player.threePointersMade}/${player.threePointersAttempted}`,
  ];
  const positions = [550, 630, 710, 790, 870, 950, 1035, 1130];
  return values.map((value, index) =>
    `<text x="${positions[index]}" y="${y}" text-anchor="middle"
      class="${total || index === 0 ? "stat-strong" : "stat"}"
      ${total || index === 0 ? `fill="${color}"` : ""}>${escapeXml(value)}</text>`,
  ).join("");
}

function teamTable(result, team, mvp, { y, color, title }) {
  const headerHeight = 44;
  const columnsHeight = 38;
  const rowHeight = 36;
  const totalHeight = 38;
  const columns = [
    [64, "PLAYER", "start"], [550, "PTS"], [630, "REB"], [710, "AST"],
    [790, "STL"], [870, "BLK"], [950, "TOV"], [1035, "FG"], [1130, "3PT"],
  ].map(([x, label, anchor = "middle"]) =>
    `<text x="${x}" y="${y + 70}" text-anchor="${anchor}" class="column">${label}</text>`,
  ).join("");
  const rows = team.players.slice(0, 5).map((rawPlayer, index) => {
    const player = enrichPlayer(result, team, rawPlayer);
    const rowY = y + headerHeight + columnsHeight + index * rowHeight;
    const textY = rowY + 25;
    const isMvp = player.teamNumber === mvp.teamNumber && player.slot === mvp.slot;
    return `
      <rect x="38" y="${rowY}" width="1124" height="${rowHeight}"
        fill="${isMvp ? "#3a3119" : index % 2 === 0 ? "#18212a" : "#111920"}"/>
      <text x="64" y="${textY}" class="player" fill="${isMvp ? "#facc15" : "#e5e7eb"}">
        ${isMvp ? "★ " : ""}${escapeXml(player.slot)} · ${escapeXml(truncate(player.cardName, 25))}
      </text>
      ${rarityBadge(player, 370, textY)}
      ${statCells(player, textY, { color })}
    `;
  }).join("");
  const teamTotals = totals(team);
  const totalY = y + headerHeight + columnsHeight + rowHeight * 5;
  return `
    <g>
      <rect x="38" y="${y}" width="1124" height="300" rx="8"
        fill="#0d141b" stroke="${color}" stroke-opacity="0.55"/>
      <rect x="38" y="${y}" width="10" height="44" rx="4" fill="${color}"/>
      <rect x="48" y="${y}" width="1114" height="44" fill="#222c36"/>
      <text x="64" y="${y + 29}" class="team-title" fill="${color}">${escapeXml(truncate(title, 52))}</text>
      <rect x="38" y="${y + headerHeight}" width="1124" height="${columnsHeight}" fill="#0b1117"/>
      ${columns}${rows}
      <rect x="38" y="${totalY}" width="1124" height="${totalHeight}" fill="#242d24"/>
      <text x="64" y="${totalY + 26}" class="total-label">TOTAL</text>
      ${statCells(teamTotals, totalY + 26, { total: true, color })}
    </g>`;
}

function leaderCard(title, player, stat, x, color) {
  return `
    <text x="${x}" y="608" text-anchor="middle" class="leader-title">${title}</text>
    <text x="${x}" y="642" text-anchor="middle" class="leader-name"
      fill="${color}">${escapeXml(truncate(player.cardName, 18))}</text>
    <text x="${x}" y="672" text-anchor="middle" class="leader-stat">${escapeXml(stat)}</text>`;
}

function createReportSvg(result, ownerDisplayName, opponentDisplayName) {
  const { playerTeam, aiTeam } = getTeams(result);
  const mvp = selectGameMvp(result);
  const leaders = selectGameLeaders(result);
  const ownerName = truncate(ownerDisplayName, 24);
  const opponentName = truncate(opponentDisplayName, 24);
  const bracket = String(result.reward?.bracketName ?? "Battle").toUpperCase();
  const won = playerTeam.finalScore > aiTeam.finalScore;
  const outcome = won ? "VICTORY" : "DEFEAT";
  const outcomeColor = won ? "#22c55e" : "#ef4444";
  const mvpColor = colorHex(rarityColor(mvp.rarityCode));
  const mvpTeamScore = mvp.teamNumber === 1 ? playerTeam.finalScore : aiTeam.finalScore;
  const pointShare = mvpTeamScore > 0
    ? Math.round((mvp.points / mvpTeamScore) * 100)
    : 0;
  const positions = [mvp.primaryPosition, mvp.secondaryPosition]
    .filter(Boolean)
    .join("/");
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
      <defs>
        <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#080d12"/><stop offset="0.55" stop-color="#101820"/>
          <stop offset="1" stop-color="#07111d"/>
        </linearGradient>
        <linearGradient id="score-panel" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#2a1704"/><stop offset="0.5" stop-color="#0a1017"/>
          <stop offset="1" stop-color="#071b34"/>
        </linearGradient>
      </defs>
      <style>
        text { font-family: Arial, "DejaVu Sans", sans-serif; }
        .eyebrow { fill:#aeb8c4; font-size:18px; font-weight:700; letter-spacing:6px; }
        .team-name { font-size:27px; font-weight:900; }
        .score { font-size:82px; font-weight:900; }
        .final { fill:#d1d5db; font-size:18px; font-weight:800; letter-spacing:4px; }
        .outcome { font-size:17px; font-weight:900; letter-spacing:3px; }
        .mvp-title { fill:#facc15; font-size:23px; font-weight:900; letter-spacing:2px; }
        .mvp-name { fill:#f8fafc; font-size:32px; font-weight:900; }
        .mvp-meta { font-size:18px; font-weight:800; }
        .mvp-major { fill:#f8fafc; font-size:27px; font-weight:900; }
        .mvp-minor { fill:#cbd5e1; font-size:18px; font-weight:700; }
        .leader-title { fill:#94a3b8; font-size:15px; font-weight:900; letter-spacing:2px; }
        .leader-name { font-size:19px; font-weight:900; }
        .leader-stat { fill:#f8fafc; font-size:18px; font-weight:800; }
        .team-title { font-size:21px; font-weight:900; }
        .column { fill:#94a3b8; font-size:15px; font-weight:900; }
        .player { font-size:17px; font-weight:800; }
        .badge { font-size:11px; font-weight:900; }
        .stat { fill:#d1d5db; font-size:18px; font-weight:700; }
        .stat-strong { font-size:18px; font-weight:900; }
        .total-label { fill:#f8fafc; font-size:18px; font-weight:900; }
        .brand { fill:#f8fafc; font-size:25px; font-weight:900; letter-spacing:3px; }
      </style>
      <rect width="1200" height="1400" fill="url(#background)"/>
      <path d="M0 0H1200V170L935 118L660 155L330 105L0 155Z" fill="#18222c" opacity="0.5"/>
      <rect x="24" y="24" width="1152" height="1352" rx="16" fill="none" stroke="#334155" stroke-width="2"/>

      <text x="600" y="64" text-anchor="middle" class="eyebrow">OPPONENT · ${escapeXml(bracket)}</text>
      <rect x="42" y="88" width="1116" height="150" rx="14" fill="url(#score-panel)"
        stroke="#334155" stroke-width="2"/>
      <text x="245" y="147" text-anchor="middle" class="team-name" fill="${TEAM_ONE_COLOR}">${escapeXml(ownerName.toUpperCase())}</text>
      <text x="472" y="194" text-anchor="middle" class="score" fill="#f59e0b">${playerTeam.finalScore}</text>
      <text x="600" y="184" text-anchor="middle" class="final">FINAL</text>
      <text x="728" y="194" text-anchor="middle" class="score" fill="#60a5fa">${aiTeam.finalScore}</text>
      <text x="955" y="147" text-anchor="middle" class="team-name" fill="${TEAM_TWO_COLOR}">${escapeXml(opponentName.toUpperCase())}</text>
      <text x="600" y="224" text-anchor="middle" class="outcome" fill="${outcomeColor}">${outcome}</text>

      <rect x="42" y="266" width="1116" height="270" rx="12" fill="#0d141b"
        stroke="#d9a928" stroke-width="2"/>
      <rect x="42" y="266" width="1116" height="48" rx="12" fill="#211a0a"/>
      <text x="600" y="298" text-anchor="middle" class="mvp-title">★ GAME MVP</text>
      <rect x="66" y="299" width="206" height="214" rx="14" fill="#090e13"/>
      <text x="310" y="356" class="mvp-name">${escapeXml(truncate(mvp.cardName.toUpperCase(), 28))}</text>
      <text x="310" y="392" class="mvp-meta" fill="${mvpColor}">${escapeXml(mvp.rarityName)} · ${escapeXml(positions)} · Level ${mvp.cardLevel}</text>
      <text x="310" y="443" class="mvp-major">${mvp.points} PTS · ${mvp.rebounds} REB · ${mvp.assists} AST</text>
      <text x="310" y="479" class="mvp-minor">${mvp.steals} STL · ${mvp.blocks} BLK · ${mvp.turnovers} TOV</text>
      <text x="790" y="398" class="mvp-minor">FG</text>
      <text x="850" y="398" class="mvp-major">${mvp.fieldGoalsMade}/${mvp.fieldGoalsAttempted}</text>
      <text x="980" y="398" class="mvp-minor">${percentage(mvp.fieldGoalsMade, mvp.fieldGoalsAttempted)}</text>
      <text x="790" y="445" class="mvp-minor">3PT</text>
      <text x="850" y="445" class="mvp-major">${mvp.threePointersMade}/${mvp.threePointersAttempted}</text>
      <text x="980" y="445" class="mvp-minor">${percentage(mvp.threePointersMade, mvp.threePointersAttempted)}</text>
      <text x="790" y="492" class="mvp-minor">TEAM POINTS</text>
      <text x="980" y="492" class="mvp-major">${pointShare}%</text>

      <rect x="42" y="554" width="1116" height="135" rx="10" fill="#0d141b" stroke="#334155"/>
      <line x1="321" y1="574" x2="321" y2="672" stroke="#263341"/>
      <line x1="600" y1="574" x2="600" y2="672" stroke="#263341"/>
      <line x1="879" y1="574" x2="879" y2="672" stroke="#263341"/>
      ${leaderCard("SCORING", leaders.scoring, `${leaders.scoring.points} PTS`, 181, leaders.scoring.teamNumber === 1 ? TEAM_ONE_COLOR : TEAM_TWO_COLOR)}
      ${leaderCard("REBOUNDING", leaders.rebounding, `${leaders.rebounding.rebounds} REB`, 460, leaders.rebounding.teamNumber === 1 ? TEAM_ONE_COLOR : TEAM_TWO_COLOR)}
      ${leaderCard("PLAYMAKING", leaders.playmaking, `${leaders.playmaking.assists} AST`, 739, leaders.playmaking.teamNumber === 1 ? TEAM_ONE_COLOR : TEAM_TWO_COLOR)}
      ${leaderCard("DEFENSE", leaders.defense, `${leaders.defense.steals} STL · ${leaders.defense.blocks} BLK`, 1018, leaders.defense.teamNumber === 1 ? TEAM_ONE_COLOR : TEAM_TWO_COLOR)}

      ${teamTable(result, playerTeam, mvp, { y: 711, color: TEAM_ONE_COLOR, title: `TEAM 1 · ${ownerName.toUpperCase()}` })}
      ${teamTable(result, aiTeam, mvp, { y: 1025, color: TEAM_TWO_COLOR, title: `TEAM 2 · ${opponentName.toUpperCase()}` })}

      <text x="600" y="1362" text-anchor="middle" class="brand">SLAMDUNK BOT</text>
    </svg>`;
}

export async function createBattleReportImage(
  result,
  {
    ownerDisplayName = "Your Team",
    opponentDisplayName = "AI Opponent",
  } = {},
) {
  const mvp = selectGameMvp(result);
  const [svg, mvpArt] = await Promise.all([
    Promise.resolve(Buffer.from(createReportSvg(
      result,
      ownerDisplayName,
      opponentDisplayName,
    ))),
    readCardArt({
      playerName: mvp.cardName,
      rarityCode: mvp.rarityCode,
    }),
  ]);
  return renderImage(async (sharp) => {
    const mvpOverlay = await sharp(mvpArt)
      .resize(198, 206, {
        fit: "contain",
        background: { r: 9, g: 14, b: 19, alpha: 1 },
      })
      .png()
      .toBuffer();

    return sharp(svg)
      .composite([{ input: mvpOverlay, left: 70, top: 303 }])
      .png({ compressionLevel: 9 })
      .toBuffer();
  });
}
