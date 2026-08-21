CREATE TABLE player_level_reward_claims (
  player_id BIGINT NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
  milestone_level INTEGER NOT NULL,
  reward_snapshot JSONB NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (player_id, milestone_level),
  CONSTRAINT player_level_reward_claims_level_positive
    CHECK (milestone_level > 0),
  CONSTRAINT player_level_reward_claims_snapshot_object
    CHECK (jsonb_typeof(reward_snapshot) = 'object')
);

CREATE INDEX player_level_reward_claims_player_claimed_idx
  ON player_level_reward_claims (player_id, claimed_at DESC);
