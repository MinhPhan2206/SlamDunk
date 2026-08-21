CREATE TABLE contract_openings (
  contract_opening_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  player_id BIGINT NOT NULL REFERENCES players(player_id),
  contract_code TEXT NOT NULL,
  item_type TEXT NOT NULL,
  discord_interaction_id TEXT NOT NULL UNIQUE,
  card_template_id BIGINT NOT NULL REFERENCES card_templates(card_template_id),
  card_instance_id BIGINT NOT NULL UNIQUE REFERENCES card_instances(card_instance_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT contract_openings_code_not_blank CHECK (BTRIM(contract_code) <> ''),
  CONSTRAINT contract_openings_item_not_blank CHECK (BTRIM(item_type) <> ''),
  CONSTRAINT contract_openings_interaction_not_blank
    CHECK (BTRIM(discord_interaction_id) <> '')
);

CREATE INDEX contract_openings_player_created_idx
  ON contract_openings (player_id, created_at DESC);
