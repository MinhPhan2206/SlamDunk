INSERT INTO trait_definitions (
  trait_code,
  trait_name,
  trait_type,
  description,
  active
)
VALUES
  ('TOUGH_SHOT_MAKER', 'Tough Shot Maker', 'SHOOTING', 'Player makes contested jump shots more effectively.', TRUE),
  ('CONTACT_FINISHER', 'Contact Finisher', 'FINISHING', 'Player finishes more effectively through contact near the basket.', TRUE),
  ('CLUTCH_PERFORMER', 'Clutch Performer', 'CLUTCH', 'Player performs better on offense during close late-game situations.', TRUE),
  ('CLUTCH_DEFENDER', 'Clutch Defender', 'CLUTCH', 'Player defends better during close late-game situations.', TRUE),
  ('COMEBACK_CATALYST', 'Comeback Catalyst', 'SITUATIONAL', 'Player performs better when the team is losing by a large margin.', TRUE),
  ('MOMENTUM_SCORER', 'Momentum Scorer', 'SITUATIONAL', 'Player becomes more effective after scoring multiple times in a row.', TRUE),
  ('COLD_BLOODED', 'Cold-Blooded', 'CLUTCH', 'Player has a higher chance of making a game-winning shot.', TRUE)
ON CONFLICT (trait_code) DO UPDATE
SET
  trait_name = EXCLUDED.trait_name,
  trait_type = EXCLUDED.trait_type,
  description = EXCLUDED.description,
  active = EXCLUDED.active,
  updated_at = CURRENT_TIMESTAMP;
