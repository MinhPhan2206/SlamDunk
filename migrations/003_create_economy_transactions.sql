CREATE TABLE economy_transactions (
  transaction_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  player_id BIGINT NOT NULL REFERENCES players (player_id),
  currency TEXT NOT NULL,
  amount BIGINT NOT NULL,
  transaction_type TEXT NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  balance_after BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT economy_transactions_currency_valid
    CHECK (currency IN ('GOLD', 'SHARDS')),
  CONSTRAINT economy_transactions_amount_non_zero CHECK (amount <> 0),
  CONSTRAINT economy_transactions_type_not_blank
    CHECK (BTRIM(transaction_type) <> ''),
  CONSTRAINT economy_transactions_reference_pair
    CHECK (
      (reference_type IS NULL AND reference_id IS NULL)
      OR
      (
        reference_type IS NOT NULL
        AND reference_id IS NOT NULL
        AND BTRIM(reference_type) <> ''
        AND BTRIM(reference_id) <> ''
      )
    ),
  CONSTRAINT economy_transactions_idempotency_key_not_blank
    CHECK (BTRIM(idempotency_key) <> ''),
  CONSTRAINT economy_transactions_balance_after_non_negative
    CHECK (balance_after >= 0)
);

CREATE INDEX economy_transactions_player_created_at_idx
  ON economy_transactions (player_id, created_at DESC);

CREATE FUNCTION prevent_economy_transaction_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Economy transactions are immutable.'
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER economy_transactions_immutable
BEFORE UPDATE OR DELETE ON economy_transactions
FOR EACH ROW
EXECUTE FUNCTION prevent_economy_transaction_mutation();
