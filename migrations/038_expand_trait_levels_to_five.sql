ALTER TABLE card_template_traits
  DROP CONSTRAINT card_template_traits_tier_valid,
  ADD CONSTRAINT card_template_traits_tier_valid
    CHECK (trait_tier BETWEEN 1 AND 5);

UPDATE trait_definitions
SET
  trait_name = CASE trait_code
    WHEN 'TOUGH_SHOT_MAKER' THEN 'Mamba Instinct'
    WHEN 'CLUTCH_PERFORMER' THEN 'Clutch Gene'
    WHEN 'CLUTCH_DEFENDER' THEN 'Moment Saver'
    ELSE trait_name
  END,
  updated_at = CURRENT_TIMESTAMP
WHERE trait_code IN (
  'TOUGH_SHOT_MAKER',
  'CLUTCH_PERFORMER',
  'CLUTCH_DEFENDER'
);
