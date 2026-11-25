CREATE INDEX IF NOT EXISTS idx_leagues_created
ON leagues (created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_league_members_player_joined
ON league_members (player_id, joined_at DESC, league_id DESC);
