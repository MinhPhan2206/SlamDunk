CREATE TABLE players (
  player_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  discord_user_id TEXT NOT NULL UNIQUE,
  username_snapshot TEXT,

  player_level INTEGER NOT NULL DEFAULT 1,
  xp BIGINT NOT NULL DEFAULT 0,
  games_played INTEGER NOT NULL DEFAULT 0,
  games_won INTEGER NOT NULL DEFAULT 0,
  games_lost INTEGER NOT NULL DEFAULT 0,
  current_win_streak INTEGER NOT NULL DEFAULT 0,
  highest_win_streak INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT players_discord_user_id_numeric
    CHECK (discord_user_id ~ '^[0-9]+$'),
  CONSTRAINT players_player_level_positive CHECK (player_level >= 1),
  CONSTRAINT players_xp_non_negative CHECK (xp >= 0),
  CONSTRAINT players_games_played_non_negative CHECK (games_played >= 0),
  CONSTRAINT players_games_won_non_negative CHECK (games_won >= 0),
  CONSTRAINT players_games_lost_non_negative CHECK (games_lost >= 0),
  CONSTRAINT players_current_win_streak_non_negative
    CHECK (current_win_streak >= 0),
  CONSTRAINT players_highest_win_streak_valid
    CHECK (highest_win_streak >= current_win_streak),
  CONSTRAINT players_game_record_valid
    CHECK (games_won + games_lost <= games_played)
);
