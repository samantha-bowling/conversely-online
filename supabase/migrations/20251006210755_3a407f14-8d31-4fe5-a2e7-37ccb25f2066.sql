-- Add behavioral tracking columns to guest_sessions
ALTER TABLE public.guest_sessions
ADD COLUMN times_blocked integer DEFAULT 0 NOT NULL,
ADD COLUMN reputation_score integer DEFAULT 0 NOT NULL,
ADD COLUMN quick_exits integer DEFAULT 0 NOT NULL,
ADD COLUMN last_quick_exit timestamp with time zone;

-- Add index for reputation-based filtering
CREATE INDEX idx_guest_sessions_reputation ON public.guest_sessions(reputation_score);

-- Add index for behavioral filtering
CREATE INDEX idx_guest_sessions_times_blocked ON public.guest_sessions(times_blocked);

-- Add comments for documentation
COMMENT ON COLUMN public.guest_sessions.times_blocked IS 'Counter for how many times this session has been blocked by others';
COMMENT ON COLUMN public.guest_sessions.reputation_score IS 'Reputation score: -3 per block, +1 per completed chat, -1 per quick exit';
COMMENT ON COLUMN public.guest_sessions.quick_exits IS 'Counter for rooms ended within 30 seconds';
COMMENT ON COLUMN public.guest_sessions.last_quick_exit IS 'Timestamp of last quick exit for rate limiting';