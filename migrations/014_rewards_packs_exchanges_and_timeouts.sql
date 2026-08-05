ALTER TABLE drop_sessions
  ADD COLUMN selection_expires_at TIMESTAMPTZ;

UPDATE drop_sessions
SET selection_expires_at = created_at + INTERVAL '10 seconds'
WHERE selection_expires_at IS NULL;

ALTER TABLE drop_sessions
  ALTER COLUMN selection_expires_at SET NOT NULL;

CREATE INDEX drop_sessions_open_expiry_idx
  ON drop_sessions (selection_expires_at)
  WHERE status = 'OPEN';

CREATE TABLE pack_openings (
  pack_opening_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  player_id BIGINT NOT NULL REFERENCES players (player_id),
  pack_code TEXT NOT NULL,
  price_gold BIGINT NOT NULL,
  discord_interaction_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'OPEN',
  card_template_id BIGINT REFERENCES card_templates (card_template_id),
  card_instance_id BIGINT UNIQUE REFERENCES card_instances (card_instance_id),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT pack_openings_code_not_blank CHECK (BTRIM(pack_code) <> ''),
  CONSTRAINT pack_openings_price_positive CHECK (price_gold > 0),
  CONSTRAINT pack_openings_interaction_not_blank
    CHECK (BTRIM(discord_interaction_id) <> ''),
  CONSTRAINT pack_openings_status_valid CHECK (status IN ('OPEN', 'COMPLETED')),
  CONSTRAINT pack_openings_state_valid CHECK (
    (status = 'OPEN' AND card_template_id IS NULL AND card_instance_id IS NULL AND completed_at IS NULL)
    OR
    (status = 'COMPLETED' AND card_template_id IS NOT NULL AND card_instance_id IS NOT NULL AND completed_at IS NOT NULL)
  )
);

CREATE INDEX pack_openings_player_created_idx
  ON pack_openings (player_id, created_at DESC);

CREATE TABLE item_exchanges (
  item_exchange_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  player_id BIGINT NOT NULL REFERENCES players (player_id),
  input_currency TEXT NOT NULL,
  input_amount BIGINT NOT NULL,
  output_item_type TEXT NOT NULL,
  output_quantity INTEGER NOT NULL,
  discord_interaction_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT item_exchanges_currency_valid CHECK (input_currency = 'SHARDS'),
  CONSTRAINT item_exchanges_input_positive CHECK (input_amount > 0),
  CONSTRAINT item_exchanges_output_type_not_blank
    CHECK (BTRIM(output_item_type) <> ''),
  CONSTRAINT item_exchanges_output_quantity_positive CHECK (output_quantity > 0),
  CONSTRAINT item_exchanges_interaction_not_blank
    CHECK (BTRIM(discord_interaction_id) <> '')
);

ALTER TABLE trades
  ADD COLUMN expires_at TIMESTAMPTZ,
  ADD COLUMN expired_at TIMESTAMPTZ;

UPDATE trades
SET expires_at = created_at + INTERVAL '3 minutes'
WHERE expires_at IS NULL;

ALTER TABLE trades
  ALTER COLUMN expires_at SET NOT NULL;

ALTER TABLE trades
  DROP CONSTRAINT trades_status_valid,
  DROP CONSTRAINT trades_status_timestamps_valid;

ALTER TABLE trades
  ADD CONSTRAINT trades_status_valid
    CHECK (status IN ('OPEN', 'COMPLETED', 'CANCELLED', 'EXPIRED')),
  ADD CONSTRAINT trades_status_timestamps_valid CHECK (
    (status = 'OPEN' AND completed_at IS NULL AND cancelled_at IS NULL AND expired_at IS NULL)
    OR
    (status = 'COMPLETED' AND completed_at IS NOT NULL AND cancelled_at IS NULL AND expired_at IS NULL)
    OR
    (status = 'CANCELLED' AND completed_at IS NULL AND cancelled_at IS NOT NULL AND expired_at IS NULL)
    OR
    (status = 'EXPIRED' AND completed_at IS NULL AND cancelled_at IS NULL AND expired_at IS NOT NULL)
  );

ALTER TABLE trade_participants
  ADD CONSTRAINT trade_participants_gold_maximum
    CHECK (gold_offered <= 20000000);

CREATE INDEX trades_open_expiry_idx
  ON trades (expires_at)
  WHERE status = 'OPEN';

ALTER TABLE trade_cards
  DROP CONSTRAINT trade_cards_outcome_valid;

ALTER TABLE trade_cards
  ADD CONSTRAINT trade_cards_outcome_valid
    CHECK (outcome IS NULL OR outcome IN ('REMOVED', 'TRANSFERRED', 'CANCELLED', 'EXPIRED'));
