export function normalizeCardLevelWeights(levelWeights) {
  if (!Array.isArray(levelWeights) || levelWeights.length !== 5) {
    throw new TypeError("Card Level weights must define Levels 1 through 5.");
  }

  const seenLevels = new Set();
  const normalized = levelWeights.map(({ level, weight }) => {
    if (
      !Number.isSafeInteger(level) ||
      level < 1 ||
      level > 5 ||
      seenLevels.has(level) ||
      !Number.isSafeInteger(weight) ||
      weight <= 0
    ) {
      throw new TypeError(
        "Each Card Level requires a unique Level from 1 through 5 and a positive integer weight.",
      );
    }
    seenLevels.add(level);
    return Object.freeze({ level, weight });
  });

  return Object.freeze(normalized.sort((left, right) => left.level - right.level));
}

export function rollCardLevel(levelWeights, rollInteger) {
  const totalWeight = levelWeights.reduce((sum, entry) => sum + entry.weight, 0);
  const roll = rollInteger(0, totalWeight);
  let cumulativeWeight = 0;

  for (const { level, weight } of levelWeights) {
    cumulativeWeight += weight;
    if (roll < cumulativeWeight) return level;
  }

  return levelWeights.at(-1).level;
}
