CREATE TABLE card_templates (
  card_template_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  player_name TEXT NOT NULL,
  edition TEXT NOT NULL,
  season TEXT,

  primary_position TEXT NOT NULL,
  secondary_position TEXT,

  rarity_tier SMALLINT NOT NULL,
  overall SMALLINT NOT NULL,

  inside_scoring SMALLINT NOT NULL,
  mid_range SMALLINT NOT NULL,
  three_point SMALLINT NOT NULL,
  playmaking SMALLINT NOT NULL,
  perimeter_defense SMALLINT NOT NULL,
  interior_defense SMALLINT NOT NULL,
  rebounding SMALLINT NOT NULL,
  athleticism SMALLINT NOT NULL,

  height_cm SMALLINT,
  weight_kg SMALLINT,

  packable BOOLEAN NOT NULL DEFAULT TRUE,
  release_date DATE,
  retired_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT card_templates_player_name_not_blank
    CHECK (BTRIM(player_name) <> ''),
  CONSTRAINT card_templates_edition_not_blank CHECK (BTRIM(edition) <> ''),
  CONSTRAINT card_templates_season_not_blank
    CHECK (season IS NULL OR BTRIM(season) <> ''),
  CONSTRAINT card_templates_primary_position_valid
    CHECK (primary_position IN ('PG', 'SG', 'SF', 'PF', 'C')),
  CONSTRAINT card_templates_secondary_position_valid
    CHECK (
      secondary_position IS NULL
      OR secondary_position IN ('PG', 'SG', 'SF', 'PF', 'C')
    ),
  CONSTRAINT card_templates_positions_distinct
    CHECK (
      secondary_position IS NULL
      OR secondary_position <> primary_position
    ),
  CONSTRAINT card_templates_rarity_tier_valid CHECK (rarity_tier BETWEEN 1 AND 7),
  CONSTRAINT card_templates_overall_valid CHECK (overall BETWEEN 60 AND 99),
  CONSTRAINT card_templates_inside_scoring_non_negative CHECK (inside_scoring >= 0),
  CONSTRAINT card_templates_mid_range_non_negative CHECK (mid_range >= 0),
  CONSTRAINT card_templates_three_point_non_negative CHECK (three_point >= 0),
  CONSTRAINT card_templates_playmaking_non_negative CHECK (playmaking >= 0),
  CONSTRAINT card_templates_perimeter_defense_non_negative
    CHECK (perimeter_defense >= 0),
  CONSTRAINT card_templates_interior_defense_non_negative
    CHECK (interior_defense >= 0),
  CONSTRAINT card_templates_rebounding_non_negative CHECK (rebounding >= 0),
  CONSTRAINT card_templates_athleticism_non_negative CHECK (athleticism >= 0),
  CONSTRAINT card_templates_height_positive CHECK (height_cm IS NULL OR height_cm > 0),
  CONSTRAINT card_templates_weight_positive CHECK (weight_kg IS NULL OR weight_kg > 0)
);

CREATE INDEX card_templates_packable_rarity_idx
  ON card_templates (packable, rarity_tier)
  WHERE packable = TRUE AND retired_at IS NULL;

CREATE TABLE trait_definitions (
  trait_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  trait_code TEXT NOT NULL UNIQUE,
  trait_name TEXT NOT NULL,
  trait_type TEXT NOT NULL,
  description TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT trait_definitions_code_valid
    CHECK (trait_code ~ '^[A-Z][A-Z0-9_]*$'),
  CONSTRAINT trait_definitions_name_not_blank CHECK (BTRIM(trait_name) <> ''),
  CONSTRAINT trait_definitions_type_valid
    CHECK (trait_type ~ '^[A-Z][A-Z0-9_]*$'),
  CONSTRAINT trait_definitions_description_not_blank
    CHECK (BTRIM(description) <> '')
);

CREATE TABLE card_template_traits (
  card_template_id BIGINT NOT NULL
    REFERENCES card_templates (card_template_id),
  trait_id BIGINT NOT NULL REFERENCES trait_definitions (trait_id),
  trait_tier SMALLINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (card_template_id, trait_id),

  CONSTRAINT card_template_traits_tier_valid CHECK (trait_tier BETWEEN 1 AND 3)
);

CREATE INDEX card_template_traits_trait_id_idx
  ON card_template_traits (trait_id);
