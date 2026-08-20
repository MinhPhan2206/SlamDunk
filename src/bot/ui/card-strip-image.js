import { getCardArtPath, readCardArt } from "./card-art.js";
import { colorHex, rarityColor } from "./theme.js";

let sharpModule;
const RESIZED_ART_CACHE_LIMIT = 256;
const resizedArtCache = new Map();

async function getSharp() {
  if (!sharpModule) sharpModule = import("sharp").then((module) => module.default);
  return sharpModule;
}

function dimensions(cardCount) {
  if (cardCount === 1) return { cardWidth: 400, cardHeight: 625, gap: 0 };
  if (cardCount <= 3) return { cardWidth: 240, cardHeight: 375, gap: 16 };
  return { cardWidth: 170, cardHeight: 266, gap: 14 };
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

async function getResizedCardArt(card, width, height) {
  const cacheKey = `${getCardArtPath(card)}:${width}x${height}`;
  const cached = resizedArtCache.get(cacheKey);
  if (cached) return cached;

  if (resizedArtCache.size >= RESIZED_ART_CACHE_LIMIT) {
    resizedArtCache.delete(resizedArtCache.keys().next().value);
  }

  const resized = Promise.all([getSharp(), readCardArt(card)]).then(
    ([sharp, source]) => sharp(source)
      .resize(width, height, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png({ compressionLevel: 6 })
      .toBuffer(),
  );
  resizedArtCache.set(cacheKey, resized);
  resized.catch(() => {
    if (resizedArtCache.get(cacheKey) === resized) resizedArtCache.delete(cacheKey);
  });
  return resized;
}

export async function createCardStripImage(cards, { labels = [] } = {}) {
  if (!Array.isArray(cards) || cards.length < 1 || cards.length > 5) {
    throw new TypeError("Card strip requires between one and five cards.");
  }
  const { cardWidth, cardHeight, gap } = dimensions(cards.length);
  const padding = 24;
  const width = padding * 2 + cardWidth * cards.length + gap * (cards.length - 1);
  const height = cardHeight + padding * 2;
  const imageWidth = cardWidth - 8;
  const imageHeight = cardHeight - 8;
  const sources = await Promise.all(
    cards.map((card) => getResizedCardArt(card, imageWidth, imageHeight)),
  );
  const overlayElements = cards.map((card, index) => {
    const x = padding + index * (cardWidth + gap);
    const border = colorHex(rarityColor(card.rarityCode));
    const label = labels[index] === undefined
      ? ""
      : `<circle cx="${x + 24}" cy="${padding + 24}" r="18" fill="#0f172a" stroke="${border}" stroke-width="3"/>
         <text x="${x + 24}" y="${padding + 31}" text-anchor="middle" fill="#f8fafc"
           font-family="Arial, sans-serif" font-size="20" font-weight="700">${escapeXml(labels[index])}</text>`;
    return `
      <g>
        <rect x="${x}" y="${padding}" width="${cardWidth}" height="${cardHeight}" rx="12"
          fill="none" stroke="${border}" stroke-width="4"/>
        ${label}
      </g>`;
  }).join("");
  const background = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect width="100%" height="100%" rx="18" fill="#0b1118"/>
    </svg>`;
  const overlay = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      ${overlayElements}
    </svg>`;
  const sharp = await getSharp();
  const images = sources.map((input, index) => ({
    input,
    left: padding + index * (cardWidth + gap) + 4,
    top: padding + 4,
  }));
  return sharp(Buffer.from(background))
    .composite([...images, { input: Buffer.from(overlay) }])
    .png({ compressionLevel: 6 })
    .toBuffer();
}
