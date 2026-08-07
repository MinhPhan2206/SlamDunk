UPDATE player_collection_preferences
SET sort_key = 'RARITY', updated_at = CURRENT_TIMESTAMP
WHERE sort_key = 'OVERALL';

ALTER TABLE player_collection_preferences
  DROP CONSTRAINT player_collection_preferences_sort_key_valid,
  ADD CONSTRAINT player_collection_preferences_sort_key_valid CHECK (
    sort_key IN (
      'OLDEST', 'NEWEST', 'RARITY', 'LEVEL', 'PLAYER_NAME', 'POSITION',
      'FINISHING', 'MID_RANGE', 'THREE_POINT', 'PLAYMAKING',
      'PERIMETER_DEFENSE', 'INTERIOR_DEFENSE', 'STRENGTH', 'HEIGHT'
    )
  );
