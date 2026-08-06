ALTER TABLE card_templates
  ADD COLUMN strength SMALLINT NOT NULL DEFAULT 50,
  ADD CONSTRAINT card_templates_strength_valid
    CHECK (strength BETWEEN 0 AND 99);
