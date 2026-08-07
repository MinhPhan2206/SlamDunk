ALTER TABLE matches
  ADD COLUMN public_match_id TEXT;

UPDATE matches
SET public_match_id = md5(
  match_id::text || ':' || request_interaction_id || ':' || started_at::text
)
WHERE public_match_id IS NULL;

ALTER TABLE matches
  ALTER COLUMN public_match_id SET NOT NULL,
  ADD CONSTRAINT matches_public_match_id_unique UNIQUE (public_match_id),
  ADD CONSTRAINT matches_public_match_id_format CHECK (
    public_match_id ~ '^[0-9a-f]{32}$'
  );
