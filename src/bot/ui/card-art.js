import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const IMAGE_ROOT = new URL("../../../assets/images/", import.meta.url);
const UNKNOWN_PATH = fileURLToPath(new URL("unknown-player.png", IMAGE_ROOT));
const ART_PATHS = new Map([
  ["GOAT:lebron james", "Goat/Lebron_James.png"],
  ["GOAT:stephen curry", "Goat/Stephen_Curry.png"],
  ["GOAT:michael jordan", "Goat/Michael_Jordan.png"],
  ["GOAT:kobe bryant", "Goat/Kobe_Bryant.png"],
  ["GOAT:kareem abdul-jabbar", "Goat/Kareem_Abdul_Jabbar.png"],
  ["SUPERSTAR:anthony edwards", "Superstar/Anthont_Edwards.png"],
  ["SUPERSTAR:kevin durant", "Superstar/Kevin_Durant.png"],
  ["SUPERSTAR:luka doncic", "Superstar/Luka.png"],
  ["SUPERSTAR:shai gilgeous-alexander", "Superstar/SGA.png"],
  ["SUPERSTAR:jayson tatum", "Superstar/Jayson_Tatum.png"],
  ["SUPERSTAR:victor wembanyama", "Superstar/Victor_Wembanyama.png"],
]);
const imageCache = new Map();

export function getCardArtPath({ playerName, rarityCode }) {
  const relativePath = ART_PATHS.get(
    `${String(rarityCode).toUpperCase()}:${String(playerName).trim().toLowerCase()}`,
  );
  return relativePath
    ? fileURLToPath(new URL(relativePath, IMAGE_ROOT))
    : UNKNOWN_PATH;
}

export function readCardArt(card) {
  const path = getCardArtPath(card);
  if (!imageCache.has(path)) imageCache.set(path, readFile(path));
  return imageCache.get(path);
}
