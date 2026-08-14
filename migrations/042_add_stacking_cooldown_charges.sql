ALTER TABLE player_cooldowns
  ADD COLUMN charges_remaining SMALLINT;

UPDATE player_cooldowns
SET charges_remaining = CASE
  WHEN available_at <= CURRENT_TIMESTAMP THEN 2
  ELSE 1
END
WHERE cooldown_type IN ('CLAIM', 'FREE_DROP');

ALTER TABLE player_cooldowns
  ADD CONSTRAINT player_cooldowns_charges_valid CHECK (
    charges_remaining IS NULL
    OR charges_remaining BETWEEN 0 AND 2
  );
