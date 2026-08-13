export const BASE_LEVEL_XP = 1_000;

const MAX_PLAYER_LEVEL = 2_147_483_647;

function normalizeLevel(level) {
  if (!Number.isSafeInteger(level) || level < 0 || level > MAX_PLAYER_LEVEL) {
    throw new TypeError("level must be a non-negative supported integer.");
  }
  return BigInt(level);
}

function normalizeTotalXp(totalXp) {
  const value = BigInt(totalXp);
  if (value < 0n) throw new TypeError("totalXp must not be negative.");
  return value;
}

export function getTotalXpRequiredForLevel(level) {
  const value = normalizeLevel(level);
  return BigInt(BASE_LEVEL_XP) * value * (value + 1n) / 2n;
}

export function getXpRequiredToAdvance(level) {
  return BigInt(BASE_LEVEL_XP) * (normalizeLevel(level) + 1n);
}

export function calculatePlayerLevel(totalXp) {
  const xp = normalizeTotalXp(totalXp);
  let low = 0n;
  let high = 1n;
  const maximum = BigInt(MAX_PLAYER_LEVEL);

  while (high < maximum && getTotalXpRequiredForLevel(Number(high)) <= xp) {
    low = high;
    high = high * 2n > maximum ? maximum : high * 2n;
  }
  while (low + 1n < high) {
    const middle = (low + high) / 2n;
    if (getTotalXpRequiredForLevel(Number(middle)) <= xp) low = middle;
    else high = middle;
  }
  if (getTotalXpRequiredForLevel(Number(high)) <= xp) low = high;
  return Number(low);
}

export function getPlayerLevelProgress(totalXp) {
  const xp = normalizeTotalXp(totalXp);
  const playerLevel = calculatePlayerLevel(xp);
  const levelStartXp = getTotalXpRequiredForLevel(playerLevel);
  const xpRequired = getXpRequiredToAdvance(playerLevel);
  return Object.freeze({
    playerLevel,
    totalXp: xp.toString(),
    xpIntoLevel: (xp - levelStartXp).toString(),
    xpRequired: xpRequired.toString(),
    totalXpForNextLevel: (levelStartXp + xpRequired).toString(),
  });
}
