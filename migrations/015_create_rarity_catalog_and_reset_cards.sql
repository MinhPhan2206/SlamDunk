CREATE TABLE rarities (
  rarity_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  rarity_code TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL UNIQUE,
  rarity_rank INTEGER NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT rarities_code_valid CHECK (rarity_code ~ '^[A-Z][A-Z0-9_]*$'),
  CONSTRAINT rarities_name_not_blank CHECK (BTRIM(display_name) <> ''),
  CONSTRAINT rarities_rank_positive CHECK (rarity_rank > 0)
);

INSERT INTO rarities (rarity_code, display_name, rarity_rank)
VALUES
  ('BASE', 'Base', 1),
  ('COMMON', 'Common', 2),
  ('UNCOMMON', 'Uncommon', 3),
  ('ALPHA', 'Alpha', 4),
  ('ALL_STAR', 'All-Star', 5),
  ('SUPERSTAR', 'Superstar', 6),
  ('GOAT', 'Goat', 7);

INSERT INTO wallets (player_id)
SELECT player_id
FROM players
ON CONFLICT (player_id) DO NOTHING;

WITH compensated AS (
  UPDATE wallets
  SET
    gold_balance = gold_balance + 20000,
    updated_at = CURRENT_TIMESTAMP
  RETURNING player_id, gold_balance
)
INSERT INTO economy_transactions (
  player_id,
  currency,
  amount,
  transaction_type,
  reference_type,
  reference_id,
  idempotency_key,
  balance_after
)
SELECT
  player_id,
  'GOLD',
  20000,
  'CARD_RESET_COMPENSATION',
  'DATABASE_MIGRATION',
  '015_create_rarity_catalog_and_reset_cards',
  'card-reset-compensation:015:player:' || player_id,
  gold_balance
FROM compensated;

UPDATE match_players
SET card_instance_id = NULL
WHERE card_instance_id IS NOT NULL;

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
DELETE FROM card_instances;
DELETE FROM card_mint_counters;

ALTER TABLE card_templates
  ADD COLUMN rarity_id BIGINT;

UPDATE card_templates ct
SET rarity_id = r.rarity_id
FROM rarities r
WHERE r.rarity_rank = ct.rarity_tier;

ALTER TABLE card_templates
  ALTER COLUMN rarity_id SET NOT NULL,
  ADD CONSTRAINT card_templates_rarity_id_fkey
    FOREIGN KEY (rarity_id) REFERENCES rarities (rarity_id),
  DROP CONSTRAINT card_templates_rarity_tier_valid;

DROP INDEX card_templates_packable_rarity_idx;

ALTER TABLE card_templates
  DROP COLUMN rarity_tier;

CREATE INDEX card_templates_packable_rarity_idx
  ON card_templates (packable, rarity_id)
  WHERE retired_at IS NULL;

ALTER TABLE drop_session_candidates
  DROP CONSTRAINT drop_session_candidates_rarity_valid,
  DROP COLUMN rolled_rarity_tier,
  ADD COLUMN rolled_rarity_id BIGINT NOT NULL
    REFERENCES rarities (rarity_id);
