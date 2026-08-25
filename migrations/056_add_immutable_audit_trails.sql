CREATE TABLE item_transactions (
  item_transaction_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  player_id BIGINT NOT NULL REFERENCES players (player_id),
  item_type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  transaction_type TEXT NOT NULL,
  balance_after INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT item_transactions_type_not_blank CHECK (BTRIM(item_type) <> ''),
  CONSTRAINT item_transactions_amount_non_zero CHECK (amount <> 0),
  CONSTRAINT item_transactions_transaction_type_valid
    CHECK (transaction_type IN ('BASELINE', 'GRANT', 'CONSUME', 'DELETE')),
  CONSTRAINT item_transactions_balance_non_negative CHECK (balance_after >= 0)
);

CREATE INDEX item_transactions_player_item_created_idx
  ON item_transactions (player_id, item_type, item_transaction_id DESC);

INSERT INTO item_transactions (
  player_id, item_type, amount, transaction_type, balance_after, created_at
)
SELECT player_id, item_type, quantity, 'BASELINE', quantity, updated_at
FROM player_items
WHERE quantity <> 0;

CREATE FUNCTION record_player_item_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  item_delta INTEGER;
  resulting_balance INTEGER;
  mutation_type TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    item_delta := NEW.quantity;
    resulting_balance := NEW.quantity;
    mutation_type := 'GRANT';
  ELSIF TG_OP = 'UPDATE' THEN
    item_delta := NEW.quantity - OLD.quantity;
    resulting_balance := NEW.quantity;
    mutation_type := CASE WHEN item_delta > 0 THEN 'GRANT' ELSE 'CONSUME' END;
  ELSE
    item_delta := -OLD.quantity;
    resulting_balance := 0;
    mutation_type := 'DELETE';
  END IF;

  IF item_delta <> 0 THEN
    INSERT INTO item_transactions (
      player_id, item_type, amount, transaction_type, balance_after
    ) VALUES (
      COALESCE(NEW.player_id, OLD.player_id),
      COALESCE(NEW.item_type, OLD.item_type),
      item_delta,
      mutation_type,
      resulting_balance
    );
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER player_items_audit
AFTER INSERT OR UPDATE OR DELETE ON player_items
FOR EACH ROW
EXECUTE FUNCTION record_player_item_transaction();

CREATE FUNCTION prevent_audit_record_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Audit records are immutable.'
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER item_transactions_immutable
BEFORE UPDATE OR DELETE ON item_transactions
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_record_mutation();

CREATE TRIGGER player_xp_transactions_immutable
BEFORE UPDATE OR DELETE ON player_xp_transactions
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_record_mutation();

CREATE TRIGGER card_ownership_history_immutable
BEFORE UPDATE OR DELETE ON card_ownership_history
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_record_mutation();

CREATE TRIGGER security_events_immutable
BEFORE UPDATE OR DELETE ON security_events
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_record_mutation();
