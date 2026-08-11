ALTER TABLE lineups
  ALTER COLUMN strategy_config SET DEFAULT
    '{"schemaVersion":"strategy-v2","preset":"BALANCED","mainHandler":"PG","offense":"BALANCED","tempo":"STANDARD","defense":"BALANCED","rebounding":"BALANCED"}'::jsonb;

UPDATE lineups
SET strategy_config = jsonb_set(
  jsonb_set(strategy_config, '{schemaVersion}', '"strategy-v2"'::jsonb, TRUE),
  '{mainHandler}',
  '"PG"'::jsonb,
  TRUE
);
