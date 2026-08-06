ALTER TABLE matches
  ADD COLUMN engine_version TEXT NOT NULL DEFAULT '1.0.0',
  ADD COLUMN ruleset_version TEXT NOT NULL DEFAULT 'aggregate-score-v1',
  ADD COLUMN config_version TEXT NOT NULL DEFAULT 'legacy',
  ADD COLUMN input_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN play_by_play JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN possession_count INTEGER NOT NULL DEFAULT 0,
  ADD CONSTRAINT matches_engine_version_not_blank
    CHECK (BTRIM(engine_version) <> ''),
  ADD CONSTRAINT matches_ruleset_version_not_blank
    CHECK (BTRIM(ruleset_version) <> ''),
  ADD CONSTRAINT matches_config_version_not_blank
    CHECK (BTRIM(config_version) <> ''),
  ADD CONSTRAINT matches_input_snapshot_object
    CHECK (jsonb_typeof(input_snapshot) = 'object'),
  ADD CONSTRAINT matches_play_by_play_array
    CHECK (jsonb_typeof(play_by_play) = 'array'),
  ADD CONSTRAINT matches_possession_count_non_negative
    CHECK (possession_count >= 0);

ALTER TABLE match_players
  ADD COLUMN reb SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN ast SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN stl SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN blk SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN tov SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN fgm SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN fga SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN three_pm SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN three_pa SMALLINT NOT NULL DEFAULT 0,
  ADD CONSTRAINT match_players_box_score_non_negative CHECK (
    reb >= 0 AND ast >= 0 AND stl >= 0 AND blk >= 0 AND tov >= 0
    AND fgm >= 0 AND fga >= 0 AND three_pm >= 0 AND three_pa >= 0
  ),
  ADD CONSTRAINT match_players_field_goals_valid CHECK (fgm <= fga),
  ADD CONSTRAINT match_players_three_pointers_valid CHECK (
    three_pm <= three_pa AND three_pm <= fgm AND three_pa <= fga
  );
