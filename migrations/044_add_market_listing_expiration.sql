ALTER TABLE market_listings
  ADD COLUMN expires_at TIMESTAMPTZ,
  ADD COLUMN expired_at TIMESTAMPTZ;

UPDATE market_listings
SET expires_at = created_at + INTERVAL '12 hours'
WHERE expires_at IS NULL;

ALTER TABLE market_listings
  ALTER COLUMN expires_at SET NOT NULL,
  DROP CONSTRAINT market_listings_status_valid,
  DROP CONSTRAINT market_listings_status_fields_valid;

ALTER TABLE market_listings
  ADD CONSTRAINT market_listings_status_valid
    CHECK (status IN ('ACTIVE', 'SOLD', 'CANCELLED', 'EXPIRED')),
  ADD CONSTRAINT market_listings_status_fields_valid CHECK (
    (status = 'ACTIVE' AND buyer_player_id IS NULL
      AND sold_at IS NULL AND cancelled_at IS NULL AND expired_at IS NULL)
    OR
    (status = 'SOLD' AND buyer_player_id IS NOT NULL
      AND sold_at IS NOT NULL AND cancelled_at IS NULL AND expired_at IS NULL)
    OR
    (status = 'CANCELLED' AND buyer_player_id IS NULL
      AND sold_at IS NULL AND cancelled_at IS NOT NULL AND expired_at IS NULL)
    OR
    (status = 'EXPIRED' AND buyer_player_id IS NULL
      AND sold_at IS NULL AND cancelled_at IS NULL AND expired_at IS NOT NULL)
  );

CREATE INDEX market_listings_active_expires_idx
  ON market_listings (expires_at, listing_id)
  WHERE status = 'ACTIVE';
