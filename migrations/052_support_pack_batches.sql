ALTER TABLE pack_openings
  ADD COLUMN pack_quantity SMALLINT NOT NULL DEFAULT 1,
  ADD CONSTRAINT pack_openings_quantity_valid
    CHECK (pack_quantity BETWEEN 1 AND 100);

ALTER TABLE pack_opening_cards
  DROP CONSTRAINT pack_opening_cards_position_valid,
  ADD CONSTRAINT pack_opening_cards_position_valid
    CHECK (card_position BETWEEN 1 AND 500);
