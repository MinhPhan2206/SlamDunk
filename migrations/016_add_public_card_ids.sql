ALTER TABLE card_instances
  ADD COLUMN public_card_id BIGINT;

UPDATE card_instances
SET public_card_id = 100000000
  + MOD(card_instance_id * 15485863, 900000000);

ALTER TABLE card_instances
  ALTER COLUMN public_card_id SET NOT NULL,
  ADD CONSTRAINT card_instances_public_card_id_unique UNIQUE (public_card_id),
  ADD CONSTRAINT card_instances_public_card_id_nine_digits
    CHECK (public_card_id BETWEEN 100000000 AND 999999999);

CREATE INDEX card_instances_owner_collection_order_idx
  ON card_instances (owner_player_id, obtained_at, card_instance_id)
  WHERE status = 'ACTIVE';
