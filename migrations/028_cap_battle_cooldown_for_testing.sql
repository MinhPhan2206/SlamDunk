UPDATE player_cooldowns
SET available_at = LEAST(available_at, updated_at + INTERVAL '10 seconds')
WHERE cooldown_type = 'BATTLE';
