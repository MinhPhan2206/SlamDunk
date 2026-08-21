ALTER TABLE duel_challenges
  ADD COLUMN bet_gold BIGINT NOT NULL DEFAULT 0,
  ADD CONSTRAINT duel_challenges_bet_gold_non_negative CHECK (bet_gold >= 0);

