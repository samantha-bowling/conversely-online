-- Add optimized index for heartbeat-based queries
-- This significantly improves performance for match-opposite and get-activity-level
-- which now filter by last_heartbeat_at as their primary presence check

CREATE INDEX IF NOT EXISTS idx_guest_sessions_heartbeat
ON guest_sessions (last_heartbeat_at DESC);

-- Rationale:
-- 1. DESC ordering: Queries check for recent heartbeats (WHERE last_heartbeat_at > X)
-- 2. Covers both match-opposite (filters for 15s freshness) and get-activity-level (filters for 17s freshness)
-- 3. Expected improvement: Sub-100ms query times even under high load
