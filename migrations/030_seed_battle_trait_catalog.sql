INSERT INTO trait_definitions (
  trait_code,
  trait_name,
  trait_type,
  description,
  active
)
VALUES
  ('PERIMETER_GRAVITY', 'Perimeter Gravity', 'OFFENSE', 'Pulls help defenders toward an elite perimeter threat.', TRUE),
  ('RANGE_EXTENDER', 'Range Extender', 'SHOOTING', 'Preserves shot quality on difficult three-point attempts.', TRUE),
  ('MIDRANGE_ASSASSIN', 'Midrange Assassin', 'SHOOTING', 'Creates an advantage on mid-range attempts.', TRUE),
  ('PAINT_FINISHER', 'Paint Finisher', 'FINISHING', 'Improves rim-pressure advantage against interior defense.', TRUE),
  ('CATCH_AND_SHOOT', 'Catch & Shoot', 'SHOOTING', 'Improves shots immediately following a pass.', TRUE),
  ('POST_TECHNICIAN', 'Post Technician', 'FINISHING', 'Creates better post-up decisions and finishing angles.', TRUE),
  ('SEPARATION_ARTIST', 'Separation Artist', 'CREATION', 'Creates space before isolation shots and drives.', TRUE),
  ('FLOOR_GENERAL', 'Floor General', 'PLAYMAKING', 'Improves team decisions and protects possession quality.', TRUE),
  ('PICK_ROLL_MAESTRO', 'Pick & Roll Maestro', 'PLAYMAKING', 'Reads and executes ball-screen actions more effectively.', TRUE),
  ('CREATIVE_PASSER', 'Creative Passer', 'PLAYMAKING', 'Completes difficult passes through defensive pressure.', TRUE),
  ('CONNECTOR', 'Connector', 'PLAYMAKING', 'Keeps the ball moving through extra passes and resets.', TRUE),
  ('SCREEN_SETTER', 'Screen Setter', 'PHYSICAL', 'Creates stronger advantages on screen actions.', TRUE),
  ('OFF_BALL_MOVER', 'Off-Ball Mover', 'OFFENSE', 'Finds space through cuts, relocations, and off-ball screens.', TRUE),
  ('POINT_OF_ATTACK_STOPPER', 'Point-of-Attack Stopper', 'DEFENSE', 'Contains the primary ball handler at the perimeter.', TRUE),
  ('SWITCHABLE_DEFENDER', 'Switchable Defender', 'DEFENSE', 'Limits mismatches created by defensive switches.', TRUE),
  ('SCREEN_NAVIGATOR', 'Screen Navigator', 'DEFENSE', 'Recovers through screens and contests the handler.', TRUE),
  ('RIM_PROTECTOR', 'Rim Protector', 'DEFENSE', 'Improves team rim contests and block pressure.', TRUE),
  ('ACTIVE_HANDS', 'Active Hands', 'DEFENSE', 'Creates steals and disrupts risky passes.', TRUE),
  ('GLASS_CLEANER', 'Glass Cleaner', 'REBOUNDING', 'Improves the chance of securing contested rebounds.', TRUE),
  ('TRANSITION_ENGINE', 'Transition Engine', 'TRANSITION', 'Improves fast-break decisions after live-ball stops.', TRUE)
ON CONFLICT (trait_code) DO UPDATE
SET
  trait_name = EXCLUDED.trait_name,
  trait_type = EXCLUDED.trait_type,
  description = EXCLUDED.description,
  active = EXCLUDED.active,
  updated_at = CURRENT_TIMESTAMP;
