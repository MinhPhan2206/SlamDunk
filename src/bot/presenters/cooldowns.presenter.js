function discordRelativeTimestamp(date) {
  return `<t:${Math.floor(date.getTime() / 1_000)}:R>`;
}

export function createCooldownsMessage(claimCooldown) {
  const claimStatus = claimCooldown.available
    ? "Ready now"
    : `Available ${discordRelativeTimestamp(claimCooldown.availableAt)}`;

  return [`**Cooldowns**`, `Claim: **${claimStatus}**`].join("\n");
}
