import { createCardStripImage } from "../ui/card-strip-image.js";

let sharpModule;

async function getSharp() {
  if (!sharpModule) sharpModule = import("sharp").then((module) => module.default);
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

function cards(lineup) {
  if (!Array.isArray(lineup) || lineup.length !== 5) {
    throw new TypeError("Duel matchup image requires two complete five-player lineups.");
  }
  return lineup.map((player) => ({
    ...player,
    playerName: player.playerName ?? player.cardName,
  }));
}

export async function createDuelMatchupImage(
  challengerLineup,
  challengedLineup,
  { challengerName = "Challenger", challengedName = "Opponent" } = {},
) {
  const sharp = await getSharp();
  const [top, bottom] = await Promise.all([
    createCardStripImage(cards(challengerLineup)),
    createCardStripImage(cards(challengedLineup)),
  ]);
  const metadata = await sharp(top).metadata();
  const width = metadata.width;
  const stripHeight = metadata.height;
  const headingHeight = 58;
  const versusHeight = 48;
  const height = headingHeight * 2 + stripHeight * 2 + versusHeight;
  const label = (name, y, color) => `
    <text x="${width / 2}" y="${y}" text-anchor="middle"
      fill="${color}" font-family="Arial, sans-serif" font-size="28"
      font-weight="700">${escapeXml(name)}</text>`;
  const background = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect width="100%" height="100%" rx="18" fill="#080d14"/>
      ${label(challengerName, 39, "#f59e0b")}
      ${label("VS", headingHeight + stripHeight + 34, "#e2e8f0")}
      ${label(challengedName, headingHeight + stripHeight + versusHeight + 39, "#8b5cf6")}
    </svg>
  `);
  return sharp(background)
    .composite([
      { input: top, top: headingHeight, left: 0 },
      {
        input: bottom,
        top: headingHeight + stripHeight + versusHeight + headingHeight,
        left: 0,
      },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();
}
