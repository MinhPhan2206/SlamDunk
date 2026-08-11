ALTER TABLE lineups
  ALTER COLUMN strategy_config SET DEFAULT
    '{"schemaVersion":"strategy-v4","mainHandler":"PG","playerTendencies":{},"offense":"BALANCED","tempo":"STANDARD","defense":"BALANCED","rebounding":"BALANCED"}'::jsonb;

UPDATE lineups AS lineup
SET strategy_config =
  (lineup.strategy_config - 'preset' - 'tendencies') ||
  jsonb_build_object(
    'schemaVersion', 'strategy-v4',
    'playerTendencies', COALESCE(
      (
        SELECT jsonb_object_agg(
          slot.card_instance_id::text,
          COALESCE(
            lineup.strategy_config -> 'tendencies',
            '{"schemaVersion":"tendency-v1","decision":"BALANCED","shotProfile":"BALANCED","creationRole":"BALANCED","usage":"NORMAL"}'::jsonb
          )
        )
        FROM lineup_slots AS slot
        WHERE slot.lineup_id = lineup.lineup_id
      ),
      '{}'::jsonb
    )
  );
