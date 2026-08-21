import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_LINEUP_STRATEGY,
  LineupError,
  createLineupService,
  setPlayerTendency,
} from "../src/modules/lineup/index.js";
import { DEFAULT_TENDENCY_PROFILE } from "../src/modules/tendency/index.js";

function lineupRow(overrides = {}) {
  return {
    lineup_id: "10", player_id: "7", lineup_number: 1,
    name: "Lineup 1", is_active: true,
    strategy_config: DEFAULT_LINEUP_STRATEGY, strategy_revision: 1,
    created_at: new Date("2026-01-01T00:00:00Z"),
    updated_at: new Date("2026-01-01T00:00:00Z"), ...overrides,
  };
}

function slotRow(cardInstanceId = "101") {
  return {
    slot: "PG", card_instance_id: cardInstanceId, player_name: "Test Guard",
    card_level: 5, rarity_code: "BASE", primary_position: "PG",
    finishing: 70, mid_range: 70, three_point: 70, playmaking: 70,
    perimeter_defense: 70, interior_defense: 70, strength: 70,
  };
}

test("Lineup service reads players and atomically saves per-player Tendencies", async () => {
  const queries = [];
  const database = {
    async query(sql, values) {
      queries.push({ sql, values });
      if (sql.includes("FROM lineups")) return { rows: [lineupRow()] };
      if (sql.includes("INSERT INTO lineups")) return { rows: [lineupRow()] };
      if (sql.includes("FROM lineup_slots ls")) return { rows: [slotRow()] };
      if (sql.includes("UPDATE lineups")) {
        return { rows: [lineupRow({
          strategy_config: JSON.parse(values[1]), strategy_revision: 2,
        })] };
      }
      throw new Error("Unexpected query.");
    },
  };
  const service = createLineupService({ databasePool: database });
  const initial = await service.getStrategy("7");
  assert.equal(initial.players[0].playerName, "Test Guard");

  const strategy = setPlayerTendency(
    { ...DEFAULT_LINEUP_STRATEGY, mainHandler: "SG", offense: "MOTION" },
    "101",
    { ...DEFAULT_TENDENCY_PROFILE, decision: "PASS_FIRST" },
  );
  const saved = await service.saveStrategy({
    playerId: "7", lineupId: "10", strategy, expectedRevision: 1,
  });
  assert.equal(saved.strategyRevision, 2);
  assert.equal(saved.strategy.playerTendencies["101"].decision, "PASS_FIRST");
  const update = queries.find((query) => query.sql.includes("UPDATE lineups"));
  assert.equal(update.values[2], 1);
  assert.equal(JSON.parse(update.values[1]).offense, "MOTION");
});

test("Lineup service rejects a stale strategy revision", async () => {
  const database = {
    async query(sql) {
      if (sql.includes("FROM lineups")) return { rows: [lineupRow()] };
      if (sql.includes("INSERT INTO lineups")) return { rows: [lineupRow()] };
      if (sql.includes("FROM lineup_slots ls")) return { rows: [] };
      if (sql.includes("UPDATE lineups")) return { rows: [] };
      throw new Error("Unexpected query.");
    },
  };
  const service = createLineupService({ databasePool: database });
  await assert.rejects(
    service.saveStrategy({
      playerId: "7", lineupId: "10",
      strategy: DEFAULT_LINEUP_STRATEGY, expectedRevision: 1,
    }),
    (error) => error instanceof LineupError &&
      error.code === "STRATEGY_REVISION_CONFLICT",
  );
});
