import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const PLACEHOLDER_PATH = fileURLToPath(
  new URL("../../../assets/images/unknown-player.png", import.meta.url),
);
const RARITY_COLORS = Object.freeze({
  BASE: "#9ca3af",
  COMMON: "#22c55e",
  UNCOMMON: "#38bdf8",
  ALPHA: "#a855f7",
  ALL_STAR: "#ef4444",
  SUPERSTAR: "#f59e0b",
  GOAT: "#facc15",
});
let sharpModule;

async function getSharp() {
  if (!sharpModule) {
    sharpModule = import("sharp").then((module) => module.default);
  }
  return sharpModule;
}

export async function createMatchupImage(aiLineup) {
  if (!Array.isArray(aiLineup) || aiLineup.length !== 5) {
    throw new TypeError("AI matchup image requires exactly five players.");
  }
  const source = (await readFile(PLACEHOLDER_PATH)).toString("base64");
  const cardWidth = 170;
  const cardHeight = 248;
  const gap = 16;
  const padding = 24;
  const width = padding * 2 + cardWidth * 5 + gap * 4;
  const height = cardHeight + padding * 2;
  const cards = aiLineup.map((player, index) => {
    const x = padding + index * (cardWidth + gap);
    const border = RARITY_COLORS[player.rarityCode] ?? RARITY_COLORS.BASE;
    return `
      <g>
        <clipPath id="clip-${index}">
          <rect x="${x}" y="${padding}" width="${cardWidth}" height="${cardHeight}" rx="12"/>
        </clipPath>
        <rect x="${x}" y="${padding}" width="${cardWidth}" height="${cardHeight}" rx="12"
          fill="#10151d" stroke="${border}" stroke-width="4"/>
        <image href="data:image/png;base64,${source}" x="${x + 4}" y="${padding + 4}"
          width="${cardWidth - 8}" height="${cardHeight - 8}" preserveAspectRatio="xMidYMid slice"
          clip-path="url(#clip-${index})"/>
      </g>`;
  }).join("");
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect width="100%" height="100%" rx="18" fill="#0a0e14"/>
      ${cards}
    </svg>`;
  const sharp = await getSharp();
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}
