ALTER TABLE matches
  ADD COLUMN reward_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD CONSTRAINT matches_reward_snapshot_object
    CHECK (jsonb_typeof(reward_snapshot) = 'object');
