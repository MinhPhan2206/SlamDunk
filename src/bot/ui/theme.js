export const UI_COLORS = Object.freeze({
  primary: 0xf59e0b,
  secondary: 0x3b82f6,
  success: 0x22c55e,
  warning: 0xf97316,
  danger: 0xef4444,
  neutral: 0x64748b,
  tie: 0x94a3b8,
});

export const RARITY_COLORS = Object.freeze({
  BASE: 0x94a3b8,
  COMMON: 0x22c55e,
  UNCOMMON: 0x38bdf8,
  ALPHA: 0xf97316,
  ALL_STAR: 0x4f46e5,
  SUPERSTAR: 0x8b5cf6,
  GOAT: 0xdc2626,
});

export function rarityColor(rarityCode) {
  return RARITY_COLORS[rarityCode] ?? UI_COLORS.neutral;
}

export function colorHex(color) {
  return `#${color.toString(16).padStart(6, "0")}`;
}
