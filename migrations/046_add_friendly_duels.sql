ALTER TABLE matches
  DROP CONSTRAINT matches_mode_valid;

ALTER TABLE matches
  ADD CONSTRAINT matches_mode_valid
  CHECK (mode IN ('PVE_5V5', 'PRACTICE_5V5', 'PVP_FRIENDLY_5V5'));

CREATE TABLE duel_challenges (
  duel_challenge_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_duel_id TEXT NOT NULL UNIQUE,
  request_interaction_id TEXT NOT NULL UNIQUE,
  challenger_player_id BIGINT NOT NULL REFERENCES players (player_id),
  challenged_player_id BIGINT NOT NULL REFERENCES players (player_id),
  status TEXT NOT NULL DEFAULT 'PENDING',
  match_id BIGINT UNIQUE REFERENCES matches (match_id),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT duel_challenges_players_different
    CHECK (challenger_player_id <> challenged_player_id),
  CONSTRAINT duel_challenges_public_id_format
    CHECK (public_duel_id ~ '^[0-9a-f]{32}$'),
  CONSTRAINT duel_challenges_status_valid
    CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED')),
  CONSTRAINT duel_challenges_lifecycle_valid CHECK (
    (status = 'PENDING' AND match_id IS NULL AND accepted_at IS NULL AND closed_at IS NULL)
    OR (status = 'ACCEPTED' AND match_id IS NOT NULL AND accepted_at IS NOT NULL AND closed_at IS NULL)
    OR (status IN ('DECLINED', 'EXPIRED') AND match_id IS NULL AND accepted_at IS NULL AND closed_at IS NOT NULL)
  )
);

CREATE INDEX duel_challenges_challenger_status_idx
  ON duel_challenges (challenger_player_id, status, expires_at DESC);

CREATE INDEX duel_challenges_challenged_status_idx
  ON duel_challenges (challenged_player_id, status, expires_at DESC);

CREATE TABLE player_duel_records (
  player_id BIGINT PRIMARY KEY REFERENCES players (player_id),
  games_played INTEGER NOT NULL DEFAULT 0,
  games_won INTEGER NOT NULL DEFAULT 0,
  games_lost INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT player_duel_records_non_negative CHECK (
    games_played >= 0 AND games_won >= 0 AND games_lost >= 0
  ),
  CONSTRAINT player_duel_records_total_valid
    CHECK (games_played = games_won + games_lost)
);
