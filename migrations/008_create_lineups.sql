CREATE TABLE lineups (
  lineup_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  player_id BIGINT NOT NULL UNIQUE REFERENCES players (player_id),
  name TEXT NOT NULL DEFAULT 'Active Lineup',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT lineups_name_not_blank CHECK (BTRIM(name) <> ''),
  CONSTRAINT lineups_active_required CHECK (is_active = TRUE)
);

CREATE TABLE lineup_slots (
  lineup_id BIGINT NOT NULL
    REFERENCES lineups (lineup_id) ON DELETE CASCADE,
  slot TEXT NOT NULL,
  card_instance_id BIGINT NOT NULL REFERENCES card_instances (card_instance_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (lineup_id, slot),
  CONSTRAINT lineup_slots_card_unique UNIQUE (lineup_id, card_instance_id),
  CONSTRAINT lineup_slots_slot_valid CHECK (slot IN ('PG', 'SG', 'SF', 'PF', 'C'))
);

CREATE INDEX lineup_slots_card_instance_idx
  ON lineup_slots (card_instance_id);
