DROP INDEX card_templates_player_name_unique_idx;

CREATE UNIQUE INDEX card_templates_player_rarity_unique_idx
  ON card_templates (LOWER(player_name), rarity_id);

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
  '021_card_template_rarity_uniqueness_and_compensation',
  'card-reset-compensation:021:player:' || player_id,
  gold_balance
FROM compensated;
