ALTER TABLE card_instances
  ADD COLUMN user_lock BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE quicksell_sessions (
  quicksell_session_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  player_id BIGINT NOT NULL REFERENCES players (player_id),
  request_params TEXT NOT NULL,
  discord_interaction_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'OPEN',
  total_shards BIGINT NOT NULL,
  shard_balance_after BIGINT,
  expires_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT quicksell_sessions_params_not_blank CHECK (BTRIM(request_params) <> ''),
  CONSTRAINT quicksell_sessions_interaction_not_blank CHECK (BTRIM(discord_interaction_id) <> ''),
  CONSTRAINT quicksell_sessions_status_valid CHECK (status IN ('OPEN', 'COMPLETED', 'CANCELLED', 'EXPIRED')),
  CONSTRAINT quicksell_sessions_total_positive CHECK (total_shards > 0),
  CONSTRAINT quicksell_sessions_state_valid CHECK (
    (status = 'OPEN' AND completed_at IS NULL AND cancelled_at IS NULL AND shard_balance_after IS NULL)
    OR (status = 'COMPLETED' AND completed_at IS NOT NULL AND cancelled_at IS NULL AND shard_balance_after IS NOT NULL)
    OR (status IN ('CANCELLED', 'EXPIRED') AND completed_at IS NULL AND cancelled_at IS NOT NULL AND shard_balance_after IS NULL)
  )
);

CREATE TABLE quicksell_session_cards (
  quicksell_session_id BIGINT NOT NULL
    REFERENCES quicksell_sessions (quicksell_session_id) ON DELETE CASCADE,
  card_instance_id BIGINT NOT NULL REFERENCES card_instances (card_instance_id),
  shard_reward BIGINT NOT NULL,
  display_position INTEGER NOT NULL,

  PRIMARY KEY (quicksell_session_id, card_instance_id),
  CONSTRAINT quicksell_session_cards_reward_positive CHECK (shard_reward > 0),
  CONSTRAINT quicksell_session_cards_position_positive CHECK (display_position > 0),
  CONSTRAINT quicksell_session_cards_position_unique
    UNIQUE (quicksell_session_id, display_position)
);

CREATE INDEX quicksell_sessions_player_created_idx
  ON quicksell_sessions (player_id, created_at DESC);
