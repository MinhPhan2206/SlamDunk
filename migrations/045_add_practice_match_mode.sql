ALTER TABLE matches
  DROP CONSTRAINT matches_mode_valid;

ALTER TABLE matches
  ADD CONSTRAINT matches_mode_valid
  CHECK (mode IN ('PVE_5V5', 'PRACTICE_5V5'));
