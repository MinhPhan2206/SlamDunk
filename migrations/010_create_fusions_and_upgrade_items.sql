CREATE TABLE player_items (
  player_id BIGINT NOT NULL REFERENCES players (player_id),
  item_type TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (player_id, item_type),
  CONSTRAINT player_items_type_not_blank CHECK (BTRIM(item_type) <> ''),
  CONSTRAINT player_items_quantity_non_negative CHECK (quantity >= 0)
);

CREATE TABLE fusions (
  fusion_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  player_id BIGINT NOT NULL REFERENCES players (player_id),
  result_card_instance_id BIGINT NOT NULL UNIQUE
    REFERENCES card_instances (card_instance_id),
  result_level SMALLINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fusions_result_level_valid CHECK (result_level BETWEEN 1 AND 5)
);

CREATE TABLE fusion_sources (
  fusion_id BIGINT NOT NULL REFERENCES fusions (fusion_id),
  source_card_instance_id BIGINT NOT NULL UNIQUE
    REFERENCES card_instances (card_instance_id),
  source_level SMALLINT NOT NULL,

  PRIMARY KEY (fusion_id, source_card_instance_id),
  CONSTRAINT fusion_sources_level_valid CHECK (source_level BETWEEN 1 AND 5)
);

CREATE TABLE upgrade_item_usages (
  upgrade_usage_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  player_id BIGINT NOT NULL REFERENCES players (player_id),
  card_instance_id BIGINT NOT NULL REFERENCES card_instances (card_instance_id),
  previous_level SMALLINT NOT NULL,
  new_level SMALLINT NOT NULL,
  item_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT upgrade_item_usages_previous_level_valid
    CHECK (previous_level BETWEEN 1 AND 4),
  CONSTRAINT upgrade_item_usages_new_level_valid
    CHECK (new_level BETWEEN 2 AND 5),
  CONSTRAINT upgrade_item_usages_level_step
    CHECK (new_level = previous_level + 1),
  CONSTRAINT upgrade_item_usages_type_not_blank CHECK (BTRIM(item_type) <> '')
);

CREATE INDEX upgrade_item_usages_player_created_idx
  ON upgrade_item_usages (player_id, created_at DESC);
