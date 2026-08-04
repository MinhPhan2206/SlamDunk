CREATE TABLE wallets (
  player_id BIGINT PRIMARY KEY REFERENCES players (player_id),
  gold_balance BIGINT NOT NULL DEFAULT 0,
  shard_balance BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT wallets_gold_balance_non_negative CHECK (gold_balance >= 0),
  CONSTRAINT wallets_shard_balance_non_negative CHECK (shard_balance >= 0)
);
