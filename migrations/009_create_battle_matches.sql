CREATE TABLE matches (
  match_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  player_id BIGINT NOT NULL REFERENCES players (player_id),
  request_interaction_id TEXT NOT NULL UNIQUE,
  mode TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  rng_seed BIGINT NOT NULL,
  winner_team SMALLINT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ,

  CONSTRAINT matches_mode_valid CHECK (mode IN ('PVE_5V5')),
  CONSTRAINT matches_status_valid CHECK (status IN ('IN_PROGRESS', 'COMPLETED')),
  CONSTRAINT matches_seed_positive CHECK (rng_seed > 0),
  CONSTRAINT matches_winner_valid CHECK (winner_team IS NULL OR winner_team IN (1, 2)),
  CONSTRAINT matches_completion_valid CHECK (
    (status = 'IN_PROGRESS' AND winner_team IS NULL AND completed_at IS NULL)
    OR
    (status = 'COMPLETED' AND winner_team IS NOT NULL AND completed_at IS NOT NULL)
  )
);

CREATE INDEX matches_player_started_idx
  ON matches (player_id, started_at DESC);

CREATE TABLE match_teams (
  match_team_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  match_id BIGINT NOT NULL REFERENCES matches (match_id),
  player_id BIGINT REFERENCES players (player_id),
  team_number SMALLINT NOT NULL,
  team_name TEXT NOT NULL,
  final_score SMALLINT NOT NULL,

  CONSTRAINT match_teams_number_valid CHECK (team_number IN (1, 2)),
  CONSTRAINT match_teams_name_not_blank CHECK (BTRIM(team_name) <> ''),
  CONSTRAINT match_teams_score_non_negative CHECK (final_score >= 0),
  CONSTRAINT match_teams_match_number_unique UNIQUE (match_id, team_number)
);

CREATE TABLE match_players (
  match_player_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  match_team_id BIGINT NOT NULL REFERENCES match_teams (match_team_id),
  card_instance_id BIGINT REFERENCES card_instances (card_instance_id),
  card_template_id BIGINT NOT NULL REFERENCES card_templates (card_template_id),
  slot TEXT NOT NULL,
  card_level_snapshot SMALLINT NOT NULL,
  card_name_snapshot TEXT NOT NULL,
  base_stats_snapshot JSONB NOT NULL,
  traits_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  pts SMALLINT NOT NULL DEFAULT 0,

  CONSTRAINT match_players_slot_valid CHECK (slot IN ('PG', 'SG', 'SF', 'PF', 'C')),
  CONSTRAINT match_players_level_valid CHECK (card_level_snapshot BETWEEN 1 AND 5),
  CONSTRAINT match_players_name_not_blank CHECK (BTRIM(card_name_snapshot) <> ''),
  CONSTRAINT match_players_pts_non_negative CHECK (pts >= 0),
  CONSTRAINT match_players_team_slot_unique UNIQUE (match_team_id, slot)
);

CREATE INDEX match_players_card_instance_idx
  ON match_players (card_instance_id)
  WHERE card_instance_id IS NOT NULL;
