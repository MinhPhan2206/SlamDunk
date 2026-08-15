import { formatRarity } from "../../config/rarity-config.js";
import { UI_EMOJIS } from "./emojis.js";

export function formatNumber(value) {
  return BigInt(value).toLocaleString("en-US");
}

export function formatGold(value) {
  return `${UI_EMOJIS.gold.mention} ${formatNumber(value)} Gold`;
}

export function formatShards(value) {
  return `${UI_EMOJIS.shard.mention} ${formatNumber(value)} Shards`;
}

export function formatCurrency(currency, value) {
  if (currency === "GOLD") return formatGold(value);
  if (currency === "SHARDS") return formatShards(value);
  return `${formatNumber(value)} ${currency}`;
}

export function formatPositions(card) {
  return [card.primaryPosition, card.secondaryPosition]
    .filter(Boolean)
    .join("/");
}

export function formatCardLine(card, { position = null } = {}) {
  const prefix = position === null ? "" : `${position}. `;
  const marker = position === null
    ? (card.userLock ? "🔒 " : "")
    : (card.userLock ? "🔒 " : "▫️ ");
  const details = [
    card.rarityCode ? formatRarity(card.rarityCode) : null,
    formatPositions(card) || null,
    card.cardLevel == null ? null : `Lv.${card.cardLevel}`,
    card.publicCardId == null ? null : `\`!${card.publicCardId}\``,
  ].filter(Boolean);
  return `${marker}**${prefix}${card.playerName}**` +
    (details.length ? ` • ${details.join(" • ")}` : "");
}

export function truncateText(value, maximum) {
  const normalized = String(value).replace(/\s+/g, " ").trim();
  if (normalized.length <= maximum) return normalized;
  return `${normalized.slice(0, Math.max(0, maximum - 3)).trimEnd()}...`;
}
