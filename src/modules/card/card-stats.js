export const CARD_STAT_FIELDS = Object.freeze([
  "threePoint",
  "midRange",
  "finishing",
  "playmaking",
  "perimeterDefense",
  "interiorDefense",
  "strength",
]);

export const MAX_CARD_LEVEL = 5;

function validateCardLevel(cardLevel) {
  if (!Number.isSafeInteger(cardLevel) || cardLevel < 1 || cardLevel > MAX_CARD_LEVEL) {
    throw new TypeError("cardLevel must be an integer from 1 through 5.");
  }
}

export function getActualCardStat(templateStat, cardLevel) {
  validateCardLevel(cardLevel);
  if (!Number.isFinite(templateStat)) {
    throw new TypeError("templateStat must be a valid number.");
  }
  return Math.max(0, templateStat - (MAX_CARD_LEVEL - cardLevel));
}

export function getActualCardStats(template, cardLevel) {
  return Object.freeze(Object.fromEntries(
    CARD_STAT_FIELDS.map((field) => [
      field,
      getActualCardStat(template[field], cardLevel),
    ]),
  ));
}
