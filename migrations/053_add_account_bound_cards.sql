ALTER TABLE card_instances
  ADD COLUMN account_bound BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX card_instances_account_bound_owner_idx
  ON card_instances (owner_player_id)
  WHERE account_bound = TRUE AND status = 'ACTIVE';

