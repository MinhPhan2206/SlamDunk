import { createUiEmbed } from "../ui/presentation.js";
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
    embeds: [createUiEmbed({ title: "COOLDOWNS", color: UI_COLORS.secondary })
      .addFields(
        { name: "CLAIM", value: status(claimCooldown), inline: true },
        { name: "DAILY", value: status(dailyCooldown), inline: true },
        { name: "WEEKLY", value: status(weeklyCooldown), inline: true },
        { name: "FREE DROP", value: status(freeDropCooldown), inline: true },
        { name: "BATTLE", value: status(battleCooldown), inline: true },
      )],
  };
}
