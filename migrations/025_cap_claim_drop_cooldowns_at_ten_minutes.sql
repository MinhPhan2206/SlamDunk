UPDATE player_cooldowns
SET available_at = LEAST(available_at, updated_at + INTERVAL '10 minutes')
WHERE cooldown_type IN ('CLAIM', 'FREE_DROP');
