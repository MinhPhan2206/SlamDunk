CREATE TABLE player_cooldowns (
  player_id BIGINT NOT NULL REFERENCES players (player_id),
  cooldown_type TEXT NOT NULL,
  available_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (player_id, cooldown_type),

  CONSTRAINT player_cooldowns_type_valid
    CHECK (cooldown_type ~ '^[A-Z][A-Z0-9_]*$')
);
