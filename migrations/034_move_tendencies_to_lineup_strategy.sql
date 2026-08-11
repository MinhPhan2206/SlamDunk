ALTER TABLE lineups
  ALTER COLUMN strategy_config SET DEFAULT
    '{"schemaVersion":"strategy-v3","preset":"BALANCED","mainHandler":"PG","tendencies":{"schemaVersion":"tendency-v1","decision":"BALANCED","shotProfile":"BALANCED","creationRole":"BALANCED","usage":"NORMAL"},"offense":"BALANCED","tempo":"STANDARD","defense":"BALANCED","rebounding":"BALANCED"}'::jsonb;

UPDATE lineups
SET strategy_config = strategy_config || jsonb_build_object(
  'schemaVersion', 'strategy-v3',
  'tendencies', '{"schemaVersion":"tendency-v1","decision":"BALANCED","shotProfile":"BALANCED","creationRole":"BALANCED","usage":"NORMAL"}'::jsonb
);

ALTER TABLE card_templates
  DROP CONSTRAINT IF EXISTS card_templates_tendency_profile_object,
  DROP COLUMN IF EXISTS tendency_profile;
