CREATE TABLE trades (
  trade_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_by_player_id BIGINT NOT NULL REFERENCES players (player_id),
  status TEXT NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,

  CONSTRAINT trades_status_valid
    CHECK (status IN ('OPEN', 'COMPLETED', 'CANCELLED')),
  CONSTRAINT trades_status_timestamps_valid CHECK (
    (status = 'OPEN' AND completed_at IS NULL AND cancelled_at IS NULL)
    OR
    (status = 'COMPLETED' AND completed_at IS NOT NULL AND cancelled_at IS NULL)
    OR
    (status = 'CANCELLED' AND completed_at IS NULL AND cancelled_at IS NOT NULL)
  )
);

CREATE TABLE trade_participants (
  trade_id BIGINT NOT NULL REFERENCES trades (trade_id),
  player_id BIGINT NOT NULL REFERENCES players (player_id),
  gold_offered BIGINT NOT NULL DEFAULT 0,
  confirmed_at TIMESTAMPTZ,

  PRIMARY KEY (trade_id, player_id),
  CONSTRAINT trade_participants_gold_non_negative CHECK (gold_offered >= 0)
);

CREATE TABLE trade_cards (
  trade_card_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  trade_id BIGINT NOT NULL,
  card_instance_id BIGINT NOT NULL REFERENCES card_instances (card_instance_id),
  offered_by_player_id BIGINT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  outcome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  removed_at TIMESTAMPTZ,

  CONSTRAINT trade_cards_participant_fk
    FOREIGN KEY (trade_id, offered_by_player_id)
    REFERENCES trade_participants (trade_id, player_id),
  CONSTRAINT trade_cards_outcome_valid
    CHECK (outcome IS NULL OR outcome IN ('REMOVED', 'TRANSFERRED', 'CANCELLED')),
  CONSTRAINT trade_cards_active_timestamp_valid CHECK (
    (active AND outcome IS NULL AND removed_at IS NULL)
    OR
    (NOT active AND outcome IS NOT NULL AND removed_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX trade_cards_active_card_unique
  ON trade_cards (card_instance_id)
  WHERE active = TRUE;

CREATE UNIQUE INDEX trade_cards_active_trade_card_unique
  ON trade_cards (trade_id, card_instance_id)
  WHERE active = TRUE;

CREATE INDEX trades_status_updated_idx
  ON trades (status, updated_at DESC);

CREATE INDEX trade_cards_trade_active_idx
  ON trade_cards (trade_id, active);
