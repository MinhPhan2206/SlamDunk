DELETE FROM quicksell_session_cards;
DELETE FROM quicksell_sessions;
DELETE FROM lineup_slots;
DELETE FROM market_listings;
DELETE FROM trade_cards;
DELETE FROM trade_participants;
DELETE FROM trades;
DELETE FROM drop_session_candidates;
DELETE FROM drop_sessions;
DELETE FROM pack_openings;
DELETE FROM upgrade_item_usages;
DELETE FROM fusion_sources;
DELETE FROM fusions;
DELETE FROM card_ownership_history;
DELETE FROM match_players;
DELETE FROM match_teams;
DELETE FROM matches;
DELETE FROM card_instances;
DELETE FROM card_mint_counters;
DELETE FROM card_template_traits;
DELETE FROM card_templates;

ALTER TABLE card_templates
  DROP COLUMN edition,
  DROP COLUMN season,
  DROP COLUMN rebounding,
  DROP COLUMN athleticism,
  DROP COLUMN weight_kg,
  DROP COLUMN release_date;

ALTER TABLE card_templates
  RENAME COLUMN inside_scoring TO finishing;

ALTER TABLE card_templates
  RENAME CONSTRAINT card_templates_inside_scoring_non_negative
  TO card_templates_finishing_non_negative;

CREATE UNIQUE INDEX card_templates_player_name_unique_idx
  ON card_templates (LOWER(player_name));
