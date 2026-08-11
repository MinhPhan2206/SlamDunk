import { formatNumber } from "../ui/formatters.js";

const relative = (date) => `<t:${Math.floor(date.getTime() / 1_000)}:R>`;

export function createDailySuccessPayload(result) {
  return {
    content: `You received ${formatNumber(result.rewardGold)} Gold and ` +
      `${formatNumber(result.rewardShards)} Shards.`,
    embeds: [],
  };
}

export function createDailyCooldownPayload(availableAt) {
  return {
    content: `Daily reward is available ${relative(availableAt)}.`,
    embeds: [],
  };
}
