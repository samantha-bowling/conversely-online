-- Phase 2: Add columns to track most recent match and prevent immediate rematching
ALTER TABLE public.guest_sessions 
ADD COLUMN IF NOT EXISTS last_matched_session_id uuid REFERENCES public.guest_sessions(id),
ADD COLUMN IF NOT EXISTS last_matched_at timestamp with time zone;

-- Add column comments for clarity
COMMENT ON COLUMN public.guest_sessions.last_matched_session_id IS 
  'Prevents immediate rematching within 30-minute cooldown window';

COMMENT ON COLUMN public.guest_sessions.last_matched_at IS 
  'Timestamp of most recent match, used for cooldown calculation';

-- Performance: Regular index for recent-match lookups (no partial predicate due to immutability requirement)
CREATE INDEX IF NOT EXISTS idx_guest_sessions_recent_match
ON public.guest_sessions (last_matched_session_id, last_matched_at);

COMMENT ON INDEX public.idx_guest_sessions_recent_match IS
  'Optimizes recent match exclusion queries during matchmaking';