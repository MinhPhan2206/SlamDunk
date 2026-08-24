CREATE TABLE security_events (
  security_event_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'WARNING',
  discord_user_id TEXT,
  guild_id TEXT,
  channel_id TEXT,
  command_name TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT security_events_type_valid
    CHECK (event_type ~ '^[A-Z][A-Z0-9_]*$'),
  CONSTRAINT security_events_severity_valid
    CHECK (severity IN ('INFO', 'WARNING', 'HIGH', 'CRITICAL'))
);

CREATE INDEX security_events_user_created_idx
  ON security_events (discord_user_id, created_at DESC)
  WHERE discord_user_id IS NOT NULL;

CREATE INDEX security_events_type_created_idx
  ON security_events (event_type, created_at DESC);

CREATE TABLE player_security_profiles (
  player_id BIGINT PRIMARY KEY REFERENCES players (player_id),
  risk_score INTEGER NOT NULL DEFAULT 0,
  earning_frozen_until TIMESTAMPTZ,
  trading_frozen_until TIMESTAMPTZ,
  disabled_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT player_security_risk_score_valid
    CHECK (risk_score BETWEEN 0 AND 10000)
);

