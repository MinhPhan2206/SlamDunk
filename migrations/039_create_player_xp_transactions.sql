CREATE TABLE player_xp_transactions (
  xp_transaction_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  player_id BIGINT NOT NULL REFERENCES players (player_id),
  amount INTEGER NOT NULL,
  source_type TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  xp_after BIGINT NOT NULL,
  player_level_after INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT player_xp_transactions_amount_positive CHECK (amount > 0),
  CONSTRAINT player_xp_transactions_source_valid
    CHECK (source_type ~ '^[A-Z][A-Z0-9_]*$'),
  CONSTRAINT player_xp_transactions_reference_not_blank
    CHECK (BTRIM(reference_id) <> ''),
  CONSTRAINT player_xp_transactions_idempotency_not_blank
    CHECK (BTRIM(idempotency_key) <> ''),
  CONSTRAINT player_xp_transactions_xp_after_non_negative CHECK (xp_after >= 0),
  CONSTRAINT player_xp_transactions_level_positive CHECK (player_level_after >= 1)
);

CREATE INDEX player_xp_transactions_player_created_idx
  ON player_xp_transactions (player_id, created_at DESC);

UPDATE players
SET player_level = FLOOR(
  (1 + SQRT(1 + 8 * (xp::numeric / 1000))) / 2
)::integer;
