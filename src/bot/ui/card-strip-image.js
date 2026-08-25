import { getCardArtPath, readCardArt } from "./card-art.js";
import { createImageBufferCache } from "./image-buffer-cache.js";
import { renderImage } from "./image-runtime.js";

const RESIZED_ART_CACHE_MAX_ENTRIES = 128;
const RESIZED_ART_CACHE_MAX_BYTES = 64 * 1_048_576;
const resizedArtCache = createImageBufferCache({
  maxEntries: RESIZED_ART_CACHE_MAX_ENTRIES,
  maxBytes: RESIZED_ART_CACHE_MAX_BYTES,
});
const inflightResizes = new Map();

function dimensions(cardCount) {
  if (cardCount === 1) return { cardWidth: 400, cardHeight: 625, gap: 0 };
  if (cardCount <= 3) return { cardWidth: 240, cardHeight: 375, gap: 6 };
  return { cardWidth: 170, cardHeight: 266, gap: 6 };
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
  const inflight = inflightResizes.get(cacheKey);
  if (inflight) return inflight;

  const resized = renderImage((sharp) => sharp(getCardArtPath(card))
      .resize(width, height, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .webp({ quality: 85, effort: 4 })
      .toBuffer())
    .then((buffer) => {
      resizedArtCache.set(cacheKey, buffer);
      return buffer;
    })
    .finally(() => inflightResizes.delete(cacheKey));
  inflightResizes.set(cacheKey, resized);
  return resized;
}

export function getCardStripCacheSnapshot() {
  return Object.freeze({
    ...resizedArtCache.snapshot(),
    inflight: inflightResizes.size,
  });
}

export async function createCardStripImage(cards, { labels = [] } = {}) {
  if (!Array.isArray(cards) || cards.length < 1 || cards.length > 5) {
    throw new TypeError("Card strip requires between one and five cards.");
  }
  if (cards.length === 1 && labels[0] === undefined) {
    return readCardArt(cards[0]);
  }
  const { cardWidth, cardHeight, gap } = dimensions(cards.length);
  const padding = 8;
  const width = padding * 2 + cardWidth * cards.length + gap * (cards.length - 1);
  const height = cardHeight + padding * 2;
  const imageWidth = cardWidth;
  const imageHeight = cardHeight;
  const sources = await Promise.all(
    cards.map((card) => getResizedCardArt(card, imageWidth, imageHeight)),
  );
  const overlayElements = cards.map((_, index) => {
    const x = padding + index * (cardWidth + gap);
    return labels[index] === undefined
      ? ""
      : `<circle cx="${x + 24}" cy="${padding + 24}" r="18" fill="#0f172a"/>
         <text x="${x + 24}" y="${padding + 31}" text-anchor="middle" fill="#f8fafc"
           font-family="Arial, sans-serif" font-size="20" font-weight="700">${escapeXml(labels[index])}</text>`;
  }).join("");
  const background = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect width="100%" height="100%" rx="18" fill="#0b1118"/>
    </svg>`;
  const overlay = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      ${overlayElements}
    </svg>`;
  const images = sources.map((input, index) => ({
    input,
    left: padding + index * (cardWidth + gap),
    top: padding,
  }));
  return renderImage((sharp) => sharp(Buffer.from(background))
    .composite([...images, { input: Buffer.from(overlay) }])
    .webp({ quality: 85, effort: 4 })
    .toBuffer());
}
