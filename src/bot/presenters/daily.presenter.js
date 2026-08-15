import { formatGold, formatNumber, formatShards } from "../ui/formatters.js";

const relative = (date) => `<t:${Math.floor(date.getTime() / 1_000)}:R>`;

export function createDailySuccessPayload(result) {
  return {
    content: `You received ${formatGold(result.rewardGold)} and ` +
      `${formatShards(result.rewardShards)}, and ` +
      `${formatNumber(result.rewardXp)} XP.`,
    embeds: [],
  };
}

export function createDailyCooldownPayload(availableAt) {
  return {
    content: `Daily reward is available ${relative(availableAt)}.`,
    embeds: [],
  };
}
