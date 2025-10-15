-- Add index for race condition resolution queries
-- This ensures O(1) lookup time when checking for existing matches

CREATE INDEX IF NOT EXISTS idx_chat_rooms_pair_status
  ON public.chat_rooms (session_a, session_b, status)
  WHERE status IN ('active', 'pending');

COMMENT ON INDEX idx_chat_rooms_pair_status IS 
  'Optimizes race condition resolution in match-opposite edge function';