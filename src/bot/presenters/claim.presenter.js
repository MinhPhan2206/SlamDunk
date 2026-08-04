function discordRelativeTimestamp(date) {
  return `<t:${Math.floor(date.getTime() / 1_000)}:R>`;
}

export function createClaimSuccessMessage(claim) {
  return [
    `You claimed **${claim.rewardGold} Gold**!`,
    `Balance: **${claim.balanceAfter} Gold**.`,
    `Next claim available ${discordRelativeTimestamp(claim.availableAt)}.`,
  ].join("\n");
}

export function createClaimCooldownMessage(availableAt) {
  return `Your \`/claim\` is on cooldown. Try again ${discordRelativeTimestamp(availableAt)}.`;
}
