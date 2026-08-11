import { EmbedBuilder } from "discord.js";
import { UI_COLORS } from "../ui/theme.js";

function status(cooldown) {
  return cooldown.available
    ? "Ready"
    : `<t:${Math.floor(cooldown.availableAt.getTime() / 1_000)}:R>`;
}

export function createCooldownsPayload(
  claimCooldown,
  dailyCooldown,
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
        { name: "Free Drop", value: status(freeDropCooldown), inline: true },
        { name: "Battle", value: status(battleCooldown), inline: true },
      )],
  };
}
