function assertConfig(maximumCharges, rechargeMinutes) {
  if (!Number.isSafeInteger(maximumCharges) || maximumCharges <= 0) {
    throw new TypeError("maximumCharges must be a positive integer.");
  }
  if (!Number.isSafeInteger(rechargeMinutes) || rechargeMinutes <= 0) {
    throw new TypeError("rechargeMinutes must be a positive integer.");
  }
}

export function resolveChargeCooldown({
  cooldown,
  currentTime,
  maximumCharges,
  rechargeMinutes,
}) {
  assertConfig(maximumCharges, rechargeMinutes);
  const now = new Date(currentTime);
  const rechargeMs = rechargeMinutes * 60_000;
  let charges = cooldown?.chargesRemaining ?? maximumCharges;
  let nextChargeAt = charges < maximumCharges
    ? new Date(cooldown.availableAt)
    : null;

  if (nextChargeAt && nextChargeAt <= now) {
    const recovered = Math.floor(
      (now.getTime() - nextChargeAt.getTime()) / rechargeMs,
    ) + 1;
    charges = Math.min(maximumCharges, charges + recovered);
    nextChargeAt = charges < maximumCharges
      ? new Date(nextChargeAt.getTime() + recovered * rechargeMs)
      : null;
  }

  return Object.freeze({
    charges,
    maximumCharges,
    available: charges > 0,
    availableAt: nextChargeAt,
    nextChargeAt,
    checkedAt: now,
  });
}

export function consumeChargeCooldown({
  state,
  currentTime,
  rechargeMinutes,
}) {
  if (state.charges <= 0) {
    throw new RangeError("No cooldown charge is available.");
  }
  const now = new Date(currentTime);
  const chargesRemaining = state.charges - 1;
  const nextChargeAt = state.nextChargeAt ??
    new Date(now.getTime() + rechargeMinutes * 60_000);
  return Object.freeze({ chargesRemaining, nextChargeAt });
}
