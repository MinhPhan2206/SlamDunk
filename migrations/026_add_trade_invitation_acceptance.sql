ALTER TABLE trade_participants
  ADD COLUMN accepted_at TIMESTAMPTZ;

UPDATE trade_participants tp
SET accepted_at = COALESCE(tp.confirmed_at, t.created_at)
FROM trades t
WHERE t.trade_id = tp.trade_id;
