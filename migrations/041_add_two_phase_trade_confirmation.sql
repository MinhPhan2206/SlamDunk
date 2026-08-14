ALTER TABLE trades
  ADD COLUMN offer_revision BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN review_started_at TIMESTAMPTZ,
  ADD CONSTRAINT trades_offer_revision_non_negative
    CHECK (offer_revision >= 0);

ALTER TABLE trade_participants
  RENAME COLUMN confirmed_at TO ready_at;

ALTER TABLE trade_participants
  ADD COLUMN ready_revision BIGINT,
  ADD COLUMN final_accepted_at TIMESTAMPTZ,
  ADD COLUMN final_accepted_revision BIGINT;

-- Existing open confirmations belonged to the old one-step flow and are not
-- safe to carry into the new two-step review flow.
UPDATE trade_participants
SET ready_at = NULL
WHERE ready_at IS NOT NULL;

ALTER TABLE trade_participants
  ADD CONSTRAINT trade_participants_ready_revision_non_negative
    CHECK (ready_revision IS NULL OR ready_revision >= 0),
  ADD CONSTRAINT trade_participants_final_revision_non_negative
    CHECK (final_accepted_revision IS NULL OR final_accepted_revision >= 0),
  ADD CONSTRAINT trade_participants_ready_state_consistent CHECK (
    (ready_at IS NULL AND ready_revision IS NULL)
    OR
    (ready_at IS NOT NULL AND ready_revision IS NOT NULL)
  ),
  ADD CONSTRAINT trade_participants_final_state_consistent CHECK (
    (final_accepted_at IS NULL AND final_accepted_revision IS NULL)
    OR
    (
      final_accepted_at IS NOT NULL
      AND final_accepted_revision IS NOT NULL
      AND ready_at IS NOT NULL
      AND ready_revision = final_accepted_revision
    )
  );
