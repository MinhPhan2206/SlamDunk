CREATE TABLE pack_opening_cards (
  pack_opening_id BIGINT NOT NULL
    REFERENCES pack_openings (pack_opening_id) ON DELETE CASCADE,
  card_position SMALLINT NOT NULL,
  card_template_id BIGINT NOT NULL
    REFERENCES card_templates (card_template_id),
  card_instance_id BIGINT NOT NULL UNIQUE
    REFERENCES card_instances (card_instance_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (pack_opening_id, card_position),
  CONSTRAINT pack_opening_cards_position_valid
    CHECK (card_position BETWEEN 1 AND 10)
);

INSERT INTO pack_opening_cards (
  pack_opening_id,
  card_position,
  card_template_id,
  card_instance_id,
  created_at
)
SELECT
  pack_opening_id,
  1,
  card_template_id,
  card_instance_id,
  completed_at
FROM pack_openings
WHERE status = 'COMPLETED'
ON CONFLICT (pack_opening_id, card_position) DO NOTHING;

CREATE INDEX pack_opening_cards_template_idx
  ON pack_opening_cards (card_template_id);
