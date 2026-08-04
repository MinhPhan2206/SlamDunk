CREATE TABLE card_mint_counters (
  card_template_id BIGINT PRIMARY KEY
    REFERENCES card_templates (card_template_id),
  last_serial_number BIGINT NOT NULL DEFAULT 0,
  total_minted BIGINT NOT NULL DEFAULT 0,
  current_circulation BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT card_mint_counters_last_serial_non_negative
    CHECK (last_serial_number >= 0),
  CONSTRAINT card_mint_counters_total_minted_non_negative
    CHECK (total_minted >= 0),
  CONSTRAINT card_mint_counters_circulation_non_negative
    CHECK (current_circulation >= 0),
  CONSTRAINT card_mint_counters_circulation_valid
    CHECK (current_circulation <= total_minted),
  CONSTRAINT card_mint_counters_serial_valid
    CHECK (last_serial_number >= total_minted)
);

CREATE TABLE card_instances (
  card_instance_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  card_template_id BIGINT NOT NULL
    REFERENCES card_templates (card_template_id),
  owner_player_id BIGINT REFERENCES players (player_id),

  serial_number BIGINT NOT NULL,
  card_level SMALLINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',

  obtained_method TEXT NOT NULL,
  obtained_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  ownership_cycles INTEGER NOT NULL DEFAULT 0,
  games_played INTEGER NOT NULL DEFAULT 0,

  market_lock BOOLEAN NOT NULL DEFAULT FALSE,
  trade_lock BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT card_instances_template_serial_unique
    UNIQUE (card_template_id, serial_number),
  CONSTRAINT card_instances_serial_positive CHECK (serial_number > 0),
  CONSTRAINT card_instances_level_valid CHECK (card_level BETWEEN 1 AND 5),
  CONSTRAINT card_instances_status_valid
    CHECK (status IN ('ACTIVE', 'DESTROYED_FUSION', 'DESTROYED_QUICKSELL')),
  CONSTRAINT card_instances_obtained_method_valid
    CHECK (obtained_method IN ('PACK', 'FUSION', 'ADMIN_GRANT', 'EVENT_REWARD')),
  CONSTRAINT card_instances_ownership_cycles_non_negative
    CHECK (ownership_cycles >= 0),
  CONSTRAINT card_instances_games_played_non_negative CHECK (games_played >= 0),
  CONSTRAINT card_instances_active_owner_required
    CHECK (status <> 'ACTIVE' OR owner_player_id IS NOT NULL),
  CONSTRAINT card_instances_locks_not_conflicting
    CHECK (NOT (market_lock AND trade_lock)),
  CONSTRAINT card_instances_destroyed_unlocked
    CHECK (status = 'ACTIVE' OR (NOT market_lock AND NOT trade_lock))
);

CREATE INDEX card_instances_owner_status_idx
  ON card_instances (owner_player_id, status)
  WHERE owner_player_id IS NOT NULL;

CREATE TABLE card_ownership_history (
  ownership_history_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  card_instance_id BIGINT NOT NULL
    REFERENCES card_instances (card_instance_id),
  from_player_id BIGINT REFERENCES players (player_id),
  to_player_id BIGINT REFERENCES players (player_id),
  reason TEXT NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT card_ownership_history_players_present
    CHECK (from_player_id IS NOT NULL OR to_player_id IS NOT NULL),
  CONSTRAINT card_ownership_history_players_distinct
    CHECK (
      from_player_id IS NULL
      OR to_player_id IS NULL
      OR from_player_id <> to_player_id
    ),
  CONSTRAINT card_ownership_history_reason_valid
    CHECK (reason ~ '^[A-Z][A-Z0-9_]*$'),
  CONSTRAINT card_ownership_history_reference_pair
    CHECK (
      (reference_type IS NULL AND reference_id IS NULL)
      OR
      (
        reference_type IS NOT NULL
        AND reference_id IS NOT NULL
        AND BTRIM(reference_type) <> ''
        AND BTRIM(reference_id) <> ''
      )
    )
);

CREATE INDEX card_ownership_history_instance_created_idx
  ON card_ownership_history (card_instance_id, created_at);
