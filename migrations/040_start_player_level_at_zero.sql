ALTER TABLE players
  DROP CONSTRAINT players_player_level_positive;

ALTER TABLE players
  ALTER COLUMN player_level SET DEFAULT 0,
  ADD CONSTRAINT players_player_level_non_negative CHECK (player_level >= 0);

ALTER TABLE player_xp_transactions
  DROP CONSTRAINT player_xp_transactions_level_positive;

ALTER TABLE player_xp_transactions
  ADD CONSTRAINT player_xp_transactions_level_non_negative
    CHECK (player_level_after >= 0);

UPDATE players
SET player_level = FLOOR(
  (-1 + SQRT(1 + 8 * (xp::numeric / 1000))) / 2
)::integer;

UPDATE player_xp_transactions
SET player_level_after = FLOOR(
  (-1 + SQRT(1 + 8 * (xp_after::numeric / 1000))) / 2
)::integer;
