ALTER TABLE lineups
  DROP CONSTRAINT lineups_player_id_key,
  DROP CONSTRAINT lineups_active_required,
  ADD COLUMN lineup_number SMALLINT NOT NULL DEFAULT 1,
  ADD CONSTRAINT lineups_number_valid CHECK (lineup_number BETWEEN 1 AND 3),
  ADD CONSTRAINT lineups_player_number_unique UNIQUE (player_id, lineup_number);

UPDATE lineups
SET name = 'Lineup 1'
WHERE lineup_number = 1;

CREATE UNIQUE INDEX lineups_one_active_per_player_idx
  ON lineups (player_id)
  WHERE is_active = TRUE;

