import { readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const IMAGE_ROOT = new URL("../../../assets/images/", import.meta.url);
const UNKNOWN_PATH = fileURLToPath(new URL("unknown-player.webp", IMAGE_ROOT));
const RARITY_FOLDERS = Object.freeze({
  GOAT: "Goat",
  SUPERSTAR: "Superstar",
  ALL_STAR: "Allstar",
  ALPHA: "Alpha",
  UNCOMMON: "Uncommon",
  COMMON: "Common",
  BASE: "Base",
});
const ART_ALIASES = new Map([
  ["SUPERSTAR:shaigilgeousalexander", "sga"],
  ["SUPERSTAR:lukadoncic", "luka"],
  ["SUPERSTAR:anthonyedwards", "anthontedwards"],
  ["ALL_STAR:karlanthonytowns", "katanthonytowns"],
  ["COMMON:jonasvalanciunas", "jonasvalanciuna"],
  ["BASE:trendonwatford", "trendonwalford"],
]);

function normalizeArtName(value) {
  return String(value)
    .normalize("NFKD")
    .replace(/\p{Mark}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function buildArtPaths() {
  const artPaths = new Map();
  for (const [rarityCode, folderName] of Object.entries(RARITY_FOLDERS)) {
    const folderUrl = new URL(`${folderName}/`, IMAGE_ROOT);
    for (const entry of readdirSync(folderUrl, { withFileTypes: true })) {
      if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== ".webp") {
        continue;
      }
      const artName = normalizeArtName(path.parse(entry.name).name);
      artPaths.set(`${rarityCode}:${artName}`, fileURLToPath(new URL(entry.name, folderUrl)));
    }
  }
  return artPaths;
}

const ART_PATHS = buildArtPaths();
export function getCardArtPath({ playerName, rarityCode }) {
  const normalizedRarity = String(rarityCode).toUpperCase();
  const cardKey = `${normalizedRarity}:${normalizeArtName(playerName)}`;
  const artName = ART_ALIASES.get(cardKey) ?? normalizeArtName(playerName);
  return ART_PATHS.get(`${normalizedRarity}:${artName}`) ?? UNKNOWN_PATH;
}

export function readCardArt(card) {
  return readFile(getCardArtPath(card));
}
