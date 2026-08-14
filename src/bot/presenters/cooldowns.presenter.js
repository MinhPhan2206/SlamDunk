import { EmbedBuilder } from "discord.js";
import { UI_COLORS } from "../ui/theme.js";

function status(cooldown) {
  if (Number.isSafeInteger(cooldown.charges)) {
    const charges = `${cooldown.charges}/${cooldown.maximumCharges} charges`;
    return cooldown.nextChargeAt
      ? `${charges} · Next <t:${Math.floor(cooldown.nextChargeAt.getTime() / 1_000)}:R>`
      : `${charges} · Ready`;
  }
  return cooldown.available
    ? "Ready"
    : `<t:${Math.floor(cooldown.availableAt.getTime() / 1_000)}:R>`;
}

export function createCooldownsPayload(
  claimCooldown,
  dailyCooldown,
  weeklyCooldown,
  freeDropCooldown,
  battleCooldown,
) {
  return {
    embeds: [new EmbedBuilder()
      .setColor(UI_COLORS.secondary)
      .setTitle("Cooldowns")
      .addFields(
        { name: "Claim", value: status(claimCooldown), inline: true },
        { name: "Daily", value: status(dailyCooldown), inline: true },
        { name: "Weekly", value: status(weeklyCooldown), inline: true },
        { name: "Free Drop", value: status(freeDropCooldown), inline: true },
        { name: "Battle", value: status(battleCooldown), inline: true },
      )],
  };
}
