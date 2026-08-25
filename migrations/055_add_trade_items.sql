CREATE TABLE trade_items (
  trade_item_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  trade_id BIGINT NOT NULL,
  offered_by_player_id BIGINT NOT NULL,
  item_type TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  outcome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMPTZ,

  CONSTRAINT trade_items_participant_fk
    FOREIGN KEY (trade_id, offered_by_player_id)
    REFERENCES trade_participants (trade_id, player_id),
  CONSTRAINT trade_items_type_not_blank CHECK (BTRIM(item_type) <> ''),
  CONSTRAINT trade_items_quantity_positive CHECK (quantity > 0),
  CONSTRAINT trade_items_outcome_valid CHECK (
    outcome IS NULL OR outcome IN ('REMOVED', 'TRANSFERRED', 'CANCELLED', 'EXPIRED')
  ),
  CONSTRAINT trade_items_state_consistent CHECK (
    (active AND outcome IS NULL AND resolved_at IS NULL)
    OR
    (NOT active AND outcome IS NOT NULL AND resolved_at IS NOT NULL)
  ),
  CONSTRAINT trade_items_offer_unique
    UNIQUE (trade_id, offered_by_player_id, item_type)
);

CREATE INDEX trade_items_trade_active_idx
  ON trade_items (trade_id, active);
