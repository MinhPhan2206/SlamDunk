CREATE TABLE player_collection_preferences (
  player_id BIGINT PRIMARY KEY REFERENCES players (player_id),
  sort_key TEXT NOT NULL DEFAULT 'OLDEST',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT player_collection_preferences_sort_key_valid CHECK (
    sort_key IN (
      'OLDEST',
      'NEWEST',
      'RARITY',
      'OVERALL',
      'LEVEL',
      'PLAYER_NAME',
      'POSITION',
      'FINISHING',
      'MID_RANGE',
      'THREE_POINT',
      'PLAYMAKING',
      'PERIMETER_DEFENSE',
      'INTERIOR_DEFENSE',
      'REBOUNDING',
      'ATHLETICISM'
    )
  )
);
