-- Add presence tracking columns to guest_sessions
ALTER TABLE guest_sessions 
ADD COLUMN last_heartbeat_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN is_searching BOOLEAN DEFAULT false;

-- Create optimized partial index for active searchers
-- Only indexes rows where is_searching = true for maximum performance
CREATE INDEX idx_guest_sessions_active_search 
ON guest_sessions(is_searching, last_heartbeat_at) 
WHERE is_searching = true;

-- Add helpful comments
COMMENT ON COLUMN guest_sessions.last_heartbeat_at IS 'Timestamp of last presence heartbeat - used to detect ghost users';
COMMENT ON COLUMN guest_sessions.is_searching IS 'Whether user is actively waiting in matching queue';