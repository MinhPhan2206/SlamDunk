import { formatGold, formatNumber, formatShards } from "../ui/formatters.js";

const relative = (date) => `<t:${Math.floor(date.getTime() / 1_000)}:R>`;

export function createWeeklySuccessPayload(result) {
  return {
    content: `You received ${formatGold(result.rewardGold)} and ` +
      `${formatShards(result.rewardShards)}, and ` +
      `${formatNumber(result.rewardXp)} XP.`,
    embeds: [],
  };
}

export function createWeeklyCooldownPayload(availableAt) {
  return {
    content: `Weekly reward is available ${relative(availableAt)}.`,
    embeds: [],
  };
}
