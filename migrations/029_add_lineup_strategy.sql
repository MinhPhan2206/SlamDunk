ALTER TABLE lineups
  ADD COLUMN strategy_config JSONB NOT NULL DEFAULT
    '{"schemaVersion":"strategy-v1","preset":"BALANCED","offense":"BALANCED","tempo":"STANDARD","defense":"BALANCED","rebounding":"BALANCED"}'::jsonb,
  ADD COLUMN strategy_revision INTEGER NOT NULL DEFAULT 1,
  ADD CONSTRAINT lineups_strategy_config_object
    CHECK (jsonb_typeof(strategy_config) = 'object'),
  ADD CONSTRAINT lineups_strategy_revision_positive
    CHECK (strategy_revision >= 1);
