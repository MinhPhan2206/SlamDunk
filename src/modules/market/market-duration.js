export const DEFAULT_MARKET_DURATION_CODE = "12h";

export const MARKET_DURATIONS = Object.freeze(new Map([
  ["1h", Object.freeze({ seconds: 3_600, label: "1 hour" })],
  ["6h", Object.freeze({ seconds: 21_600, label: "6 hours" })],
  ["12h", Object.freeze({ seconds: 43_200, label: "12 hours" })],
  ["1d", Object.freeze({ seconds: 86_400, label: "1 day" })],
  ["3d", Object.freeze({ seconds: 259_200, label: "3 days" })],
  ["7d", Object.freeze({ seconds: 604_800, label: "7 days" })],
]));

export const MARKET_DURATION_CODES = Object.freeze([...MARKET_DURATIONS.keys()]);

export function resolveMarketDuration(value) {
  const code = String(value ?? "").trim().toLowerCase();
  const duration = MARKET_DURATIONS.get(code);
  if (!duration) {
    throw new TypeError("Duration must be 1h, 6h, 12h, 1d, 3d, or 7d.");
  }
  return Object.freeze({ code, ...duration });
}
