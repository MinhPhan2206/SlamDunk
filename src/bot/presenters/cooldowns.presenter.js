function discordRelativeTimestamp(date) {
  return `<t:${Math.floor(date.getTime() / 1_000)}:R>`;
}

function cooldownStatus(cooldown) {
  return cooldown.available
    ? "Ready now"
    : `Available ${discordRelativeTimestamp(cooldown.availableAt)}`;
}

export function createCooldownsMessage(claimCooldown, dailyCooldown, freeDropCooldown) {
  return [
    `**Cooldowns**`,
    `Claim: **${cooldownStatus(claimCooldown)}**`,
    `Daily: **${cooldownStatus(dailyCooldown)}**`,
    `Free Drop: **${cooldownStatus(freeDropCooldown)}**`,
  ].join("\n");
}
