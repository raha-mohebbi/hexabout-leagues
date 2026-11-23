
-- =====================================================
-- Hexabout Leagues - Database Schema
-- PostgreSQL 17
-- =====================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- =====================================================
-- 1. League Periods
-- =====================================================

CREATE TABLE league_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'upcoming'
        CHECK (status IN ('upcoming', 'active', 'completed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_period_dates
        CHECK (ends_at > starts_at)
);


-- =====================================================
-- 2. Leagues
-- =====================================================

CREATE TABLE leagues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_id UUID NOT NULL REFERENCES league_periods(id),
    name VARCHAR(100) NOT NULL,
    tier VARCHAR(30) NOT NULL DEFAULT 'bronze',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Allows members to reference a league and its period together
    CONSTRAINT unique_league_period UNIQUE (id, period_id)
);


-- =====================================================
-- 3. League Members
-- =====================================================

CREATE TABLE league_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID NOT NULL,
    period_id UUID NOT NULL REFERENCES league_periods(id),
    player_id UUID NOT NULL,
    score INTEGER NOT NULL DEFAULT 0
        CHECK (score >= 0),
    score_reached_at TIMESTAMPTZ,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- A player can join only one league per period
    CONSTRAINT unique_player_per_period
        UNIQUE (period_id, player_id),

    -- Prevent duplicate membership in the same league
    CONSTRAINT unique_member_per_league
        UNIQUE (league_id, player_id),

    -- Ensure the league belongs to the specified period
    CONSTRAINT fk_member_league_period
        FOREIGN KEY (league_id, period_id)
        REFERENCES leagues(id, period_id)
);


-- =====================================================
-- 4. Match Results
-- =====================================================

CREATE TABLE match_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_match_id VARCHAR(150) NOT NULL UNIQUE,
    league_id UUID NOT NULL REFERENCES leagues(id),
    winner_id UUID NOT NULL,
    loser_id UUID NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'reported'
        CHECK (status IN ('reported', 'voided')),
    reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    voided_at TIMESTAMPTZ,

    CONSTRAINT different_match_players
        CHECK (winner_id <> loser_id)
);


-- =====================================================
-- 5. Score Events
-- =====================================================

CREATE TABLE score_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_result_id UUID NOT NULL REFERENCES match_results(id),
    player_id UUID NOT NULL,
    event_type VARCHAR(20) NOT NULL
        CHECK (event_type IN ('award', 'reversal')),
    points INTEGER NOT NULL
        CHECK (points > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- One award and one reversal per player per match
    CONSTRAINT unique_score_event
        UNIQUE (match_result_id, player_id, event_type)
);


-- =====================================================
-- 6. Admin Users
-- =====================================================

CREATE TABLE admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL
        CHECK (role IN ('superadmin', 'admin', 'manager')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =====================================================
-- 7. Admin Audit Logs
-- =====================================================

CREATE TABLE admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES admin_users(id),
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_id UUID NOT NULL,
    reason TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =====================================================
-- 8. Indexes
-- =====================================================

-- Leaderboard sorting
CREATE INDEX idx_league_members_leaderboard
ON league_members (
    league_id,
    score DESC,
    score_reached_at ASC,
    player_id ASC
);

-- League pagination
CREATE INDEX idx_leagues_period_created
ON leagues (
    period_id,
    created_at DESC,
    id DESC
);

-- Match lookup by league
CREATE INDEX idx_match_results_league_reported
ON match_results (
    league_id,
    reported_at DESC
);

-- Score history lookup
CREATE INDEX idx_score_events_player
ON score_events (
    player_id,
    created_at DESC
);

-- Admin audit history lookup
CREATE INDEX idx_admin_audit_target
ON admin_audit_logs (
    target_type,
    target_id,
    created_at DESC
);
