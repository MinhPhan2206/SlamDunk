import { formatGold } from "../ui/formatters.js";

function relative(date) {
  return `<t:${Math.floor(date.getTime() / 1_000)}:R>`;
}

export function createClaimSuccessPayload(claim) {
  return {
    content: `You received ${formatGold(claim.rewardGold)}.`,
    embeds: [],
  };
}

export function createClaimCooldownPayload(availableAt) {
  return {
    content: `Claim is available ${relative(availableAt)}.`,
    embeds: [],
  };
}
