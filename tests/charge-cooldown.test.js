import assert from "node:assert/strict";
import test from "node:test";

import {
  consumeChargeCooldown,
  resolveChargeCooldown,
} from "../src/modules/reward/charge-cooldown.js";

test("stacking cooldown recovers one charge every 15 minutes up to two", () => {
  const cooldown = {
    chargesRemaining: 0,
    availableAt: new Date("2030-01-01T00:15:00.000Z"),
  };

  const oneCharge = resolveChargeCooldown({
    cooldown,
    currentTime: new Date("2030-01-01T00:20:00.000Z"),
    maximumCharges: 2,
    rechargeMinutes: 15,
  });
  assert.equal(oneCharge.charges, 1);
  assert.equal(oneCharge.nextChargeAt.toISOString(), "2030-01-01T00:30:00.000Z");

  const full = resolveChargeCooldown({
    cooldown,
    currentTime: new Date("2030-01-01T00:31:00.000Z"),
    maximumCharges: 2,
    rechargeMinutes: 15,
  });
  assert.equal(full.charges, 2);
  assert.equal(full.nextChargeAt, null);

  const consumed = consumeChargeCooldown({
    state: full,
    currentTime: new Date("2030-01-01T00:31:00.000Z"),
    rechargeMinutes: 15,
  });
  assert.equal(consumed.chargesRemaining, 1);
  assert.equal(consumed.nextChargeAt.toISOString(), "2030-01-01T00:46:00.000Z");
});

test("using the stored charge preserves partial recharge progress", () => {
  const state = resolveChargeCooldown({
    cooldown: {
      chargesRemaining: 1,
      availableAt: new Date("2030-01-01T00:15:00.000Z"),
    },
    currentTime: new Date("2030-01-01T00:10:00.000Z"),
    maximumCharges: 2,
    rechargeMinutes: 15,
  });
  const consumed = consumeChargeCooldown({
    state,
    currentTime: new Date("2030-01-01T00:10:00.000Z"),
    rechargeMinutes: 15,
  });

  assert.equal(consumed.chargesRemaining, 0);
  assert.equal(consumed.nextChargeAt.toISOString(), "2030-01-01T00:15:00.000Z");
});
