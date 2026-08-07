import { EmbedBuilder } from "discord.js";
import { formatNumber } from "../ui/formatters.js";
import { UI_COLORS } from "../ui/theme.js";

function relative(date) {
  return `<t:${Math.floor(date.getTime() / 1_000)}:R>`;
}

export function createClaimSuccessPayload(claim) {
  return {
    embeds: [new EmbedBuilder()
      .setColor(UI_COLORS.success)
      .setTitle("Claim Complete")
      .setDescription(`Next Claim: ${relative(claim.availableAt)}`)
      .addFields(
        {
          name: "Reward",
          value: `${formatNumber(claim.rewardGold)} Gold`,
          inline: true,
        },
        {
          name: "Gold Balance",
          value: formatNumber(claim.balanceAfter),
          inline: true,
        },
      )],
  };
}

export function createClaimCooldownPayload(availableAt) {
  return {
    embeds: [new EmbedBuilder()
      .setColor(UI_COLORS.warning)
      .setTitle("Claim Cooldown")
      .setDescription(`Available ${relative(availableAt)}.`)],
  };
}
