CREATE TABLE market_listings (
  listing_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  seller_player_id BIGINT NOT NULL REFERENCES players (player_id),
  card_instance_id BIGINT NOT NULL REFERENCES card_instances (card_instance_id),
  price_gold BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  buyer_player_id BIGINT REFERENCES players (player_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sold_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,

  CONSTRAINT market_listings_price_positive CHECK (price_gold > 0),
  CONSTRAINT market_listings_status_valid
    CHECK (status IN ('ACTIVE', 'SOLD', 'CANCELLED')),
  CONSTRAINT market_listings_buyer_distinct
    CHECK (buyer_player_id IS NULL OR buyer_player_id <> seller_player_id),
  CONSTRAINT market_listings_status_fields_valid CHECK (
    (status = 'ACTIVE' AND buyer_player_id IS NULL
      AND sold_at IS NULL AND cancelled_at IS NULL)
    OR
    (status = 'SOLD' AND buyer_player_id IS NOT NULL
      AND sold_at IS NOT NULL AND cancelled_at IS NULL)
    OR
    (status = 'CANCELLED' AND buyer_player_id IS NULL
      AND sold_at IS NULL AND cancelled_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX market_listings_active_card_unique
  ON market_listings (card_instance_id)
  WHERE status = 'ACTIVE';

CREATE INDEX market_listings_active_created_idx
  ON market_listings (created_at DESC, listing_id DESC)
  WHERE status = 'ACTIVE';

CREATE INDEX market_listings_seller_created_idx
  ON market_listings (seller_player_id, created_at DESC);
