CREATE TABLE pack_sessions (
  pack_session_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  player_id BIGINT NOT NULL REFERENCES players (player_id),
  pack_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  created_interaction_id TEXT NOT NULL UNIQUE,
  selected_template_id BIGINT REFERENCES card_templates (card_template_id),
  result_card_instance_id BIGINT UNIQUE
    REFERENCES card_instances (card_instance_id),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT pack_sessions_type_valid
    CHECK (pack_type IN ('FREE_DROP')),
  CONSTRAINT pack_sessions_status_valid
    CHECK (status IN ('OPEN', 'COMPLETED')),
  CONSTRAINT pack_sessions_interaction_present
    CHECK (BTRIM(created_interaction_id) <> ''),
  CONSTRAINT pack_sessions_state_valid
    CHECK (
      (
        status = 'OPEN'
        AND selected_template_id IS NULL
        AND result_card_instance_id IS NULL
        AND completed_at IS NULL
      )
      OR
      (
        status = 'COMPLETED'
        AND selected_template_id IS NOT NULL
        AND result_card_instance_id IS NOT NULL
        AND completed_at IS NOT NULL
      )
    )
);

CREATE UNIQUE INDEX pack_sessions_one_open_free_drop_per_player_idx
  ON pack_sessions (player_id, pack_type)
  WHERE status = 'OPEN';

CREATE INDEX pack_sessions_player_created_idx
  ON pack_sessions (player_id, created_at DESC);

CREATE TABLE pack_session_candidates (
  pack_session_id BIGINT NOT NULL
    REFERENCES pack_sessions (pack_session_id),
  candidate_position SMALLINT NOT NULL,
  card_template_id BIGINT NOT NULL
    REFERENCES card_templates (card_template_id),
  rolled_rarity_tier SMALLINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (pack_session_id, candidate_position),
  CONSTRAINT pack_session_candidates_template_unique
    UNIQUE (pack_session_id, card_template_id),
  CONSTRAINT pack_session_candidates_position_valid
    CHECK (candidate_position BETWEEN 1 AND 10),
  CONSTRAINT pack_session_candidates_rarity_valid
    CHECK (rolled_rarity_tier BETWEEN 1 AND 7)
);

CREATE INDEX pack_session_candidates_template_idx
  ON pack_session_candidates (card_template_id);
