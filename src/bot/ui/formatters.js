import { formatRarity } from "../../config/rarity-config.js";

export function formatNumber(value) {
  return BigInt(value).toLocaleString("en-US");
}

export function formatPositions(card) {
  return [card.primaryPosition, card.secondaryPosition]
    .filter(Boolean)
    .join("/");
}

export function formatCardLine(card, { position = null } = {}) {
  const prefix = position === null ? "" : `${position}. `;
  const lock = card.userLock ? "🔒 " : "";
  const details = [
    card.rarityCode ? formatRarity(card.rarityCode) : null,
    formatPositions(card) || null,
    card.cardLevel == null ? null : `Lv.${card.cardLevel}`,
    card.publicCardId == null ? null : `\`!${card.publicCardId}\``,
  ].filter(Boolean);
  return `${lock}**${prefix}${card.playerName}**` +
    (details.length ? ` • ${details.join(" • ")}` : "");
}

export function truncateText(value, maximum) {
  const normalized = String(value).replace(/\s+/g, " ").trim();
  if (normalized.length <= maximum) return normalized;
  return `${normalized.slice(0, Math.max(0, maximum - 3)).trimEnd()}...`;
}
