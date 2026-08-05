import { buildRarityOdds } from "../rarity/rarity-odds.js";
import { PackError } from "./pack.errors.js";

function normalizeCatalog(packCatalog) {
  if (!Array.isArray(packCatalog) || packCatalog.length === 0) {
    throw new TypeError("packCatalog must contain at least one Pack definition.");
  }
  const packs = new Map();
  let defaultPackCode = null;
  for (const definition of packCatalog) {
    if (
      typeof definition.packCode !== "string" ||
      !/^[a-z][a-z0-9_-]*$/.test(definition.packCode) ||
      typeof definition.displayName !== "string" ||
      definition.displayName.trim().length === 0 ||
      packs.has(definition.packCode)
    ) {
      throw new TypeError("Each Pack requires a unique code and display name.");
    }
    const pack = Object.freeze({
      packCode: definition.packCode,
      displayName: definition.displayName.trim(),
      odds: buildRarityOdds(definition.rarityWeights),
    });
    packs.set(pack.packCode, pack);
    if (definition.default) {
      if (defaultPackCode) {
        throw new TypeError("Only one Pack can be the default.");
      }
      defaultPackCode = pack.packCode;
    }
  }
  return Object.freeze({ packs, defaultPackCode: defaultPackCode ?? packs.keys().next().value });
}

export function createPackService({ packCatalog }) {
  const catalog = normalizeCatalog(packCatalog);

  return Object.freeze({
    getOdds(packCode = catalog.defaultPackCode) {
      const normalizedCode = String(packCode).trim().toLowerCase();
      const pack = catalog.packs.get(normalizedCode);
      if (!pack) {
        throw new PackError(
          "PACK_NOT_FOUND",
          `Pack '${normalizedCode}' is not configured.`,
        );
      }
      return Object.freeze({ source: "pack", ...pack });
    },

    listPacks() {
      return Object.freeze([...catalog.packs.values()]);
    },
  });
}
