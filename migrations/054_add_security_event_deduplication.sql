ALTER TABLE security_events
  ADD COLUMN deduplication_key TEXT;

CREATE UNIQUE INDEX security_events_deduplication_unique
  ON security_events (deduplication_key)
  WHERE deduplication_key IS NOT NULL;

