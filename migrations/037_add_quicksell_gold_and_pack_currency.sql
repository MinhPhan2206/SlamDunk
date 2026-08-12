ALTER TABLE quicksell_sessions
  ADD COLUMN total_gold BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN gold_balance_after BIGINT;

ALTER TABLE quicksell_session_cards
  ADD COLUMN gold_reward BIGINT NOT NULL DEFAULT 0;

ALTER TABLE quicksell_sessions
  ADD CONSTRAINT quicksell_sessions_gold_non_negative CHECK (total_gold >= 0);

ALTER TABLE quicksell_session_cards
  ADD CONSTRAINT quicksell_session_cards_gold_non_negative CHECK (gold_reward >= 0);

ALTER TABLE pack_openings
  ADD COLUMN payment_currency TEXT NOT NULL DEFAULT 'GOLD',
  ADD COLUMN price_amount BIGINT;

UPDATE pack_openings
SET price_amount = price_gold
WHERE price_amount IS NULL;

ALTER TABLE pack_openings
  ALTER COLUMN price_amount SET NOT NULL,
  DROP CONSTRAINT pack_openings_price_positive,
  ADD CONSTRAINT pack_openings_legacy_gold_non_negative CHECK (price_gold >= 0),
  ADD CONSTRAINT pack_openings_payment_currency_valid
    CHECK (payment_currency IN ('GOLD', 'SHARDS')),
  ADD CONSTRAINT pack_openings_price_amount_positive CHECK (price_amount > 0),
  ADD CONSTRAINT pack_openings_payment_consistent CHECK (
    (payment_currency = 'GOLD' AND price_gold = price_amount)
    OR (payment_currency = 'SHARDS' AND price_gold = 0)
  );
