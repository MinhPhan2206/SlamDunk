import { readCardArt } from "./card-art.js";
import { colorHex, rarityColor } from "./theme.js";

let sharpModule;

async function getSharp() {
  if (!sharpModule) sharpModule = import("sharp").then((module) => module.default);
  return sharpModule;
}

function dimensions(cardCount) {
  if (cardCount === 1) return { cardWidth: 400, cardHeight: 625, gap: 0 };
  if (cardCount <= 3) return { cardWidth: 240, cardHeight: 375, gap: 16 };
  return { cardWidth: 170, cardHeight: 266, gap: 14 };
}

export async function createCardStripImage(cards, { labels = [] } = {}) {
  if (!Array.isArray(cards) || cards.length < 1 || cards.length > 5) {
    throw new TypeError("Card strip requires between one and five cards.");
  }
  const { cardWidth, cardHeight, gap } = dimensions(cards.length);
  const padding = 24;
  const width = padding * 2 + cardWidth * cards.length + gap * (cards.length - 1);
  const height = cardHeight + padding * 2;
  const sources = await Promise.all(cards.map(async (card) =>
    (await readCardArt(card)).toString("base64")
  ));
  const cardElements = cards.map((card, index) => {
    const x = padding + index * (cardWidth + gap);
    const border = colorHex(rarityColor(card.rarityCode));
    const label = labels[index] === undefined
      ? ""
      : `<circle cx="${x + 24}" cy="${padding + 24}" r="18" fill="#0f172a" stroke="${border}" stroke-width="3"/>
         <text x="${x + 24}" y="${padding + 31}" text-anchor="middle" fill="#f8fafc"
           font-family="Arial, sans-serif" font-size="20" font-weight="700">${labels[index]}</text>`;
    return `
      <g>
        <clipPath id="card-${index}">
          <rect x="${x}" y="${padding}" width="${cardWidth}" height="${cardHeight}" rx="12"/>
        </clipPath>
        <rect x="${x}" y="${padding}" width="${cardWidth}" height="${cardHeight}" rx="12"
          fill="#0f172a" stroke="${border}" stroke-width="4"/>
        <image href="data:image/png;base64,${sources[index]}" x="${x + 4}" y="${padding + 4}"
          width="${cardWidth - 8}" height="${cardHeight - 8}" preserveAspectRatio="xMidYMid meet"
          clip-path="url(#card-${index})"/>
        ${label}
      </g>`;
  }).join("");
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect width="100%" height="100%" rx="18" fill="#0b1118"/>
      ${cardElements}
    </svg>`;
  const sharp = await getSharp();
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}
