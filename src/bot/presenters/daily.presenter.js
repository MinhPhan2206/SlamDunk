import { EmbedBuilder } from "discord.js";
import { formatNumber } from "../ui/formatters.js";
import { UI_COLORS } from "../ui/theme.js";

const relative = (date) => `<t:${Math.floor(date.getTime() / 1_000)}:R>`;

export function createDailySuccessPayload(result) {
  return {
    embeds: [new EmbedBuilder()
      .setColor(UI_COLORS.success)
      .setTitle("Daily Reward Claimed")
      .setDescription(`Next Daily: ${relative(result.availableAt)}`)
      .addFields(
        {
          name: "Reward",
          value: `${formatNumber(result.rewardGold)} Gold\n` +
            `${formatNumber(result.rewardShards)} Shards`,
          inline: true,
        },
        {
          name: "Balances",
          value: `${formatNumber(result.goldBalanceAfter)} Gold\n` +
            `${formatNumber(result.shardBalanceAfter)} Shards`,
          inline: true,
        },
      )],
  };
}

export function createDailyCooldownPayload(availableAt) {
  return {
    embeds: [new EmbedBuilder()
      .setColor(UI_COLORS.warning)
      .setTitle("Daily Cooldown")
      .setDescription(`Available ${relative(availableAt)}.`)],
  };
}
