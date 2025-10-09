-- Phase 1: Convert guest_sessions_public to SECURITY INVOKER
-- This ensures RLS policies are evaluated with the caller's privileges, not the view owner's

-- Drop existing view
DROP VIEW IF EXISTS public.guest_sessions_public;

-- Recreate with SECURITY INVOKER
CREATE VIEW public.guest_sessions_public
WITH (security_invoker = true) AS
SELECT 
  id,
  created_at,
  expires_at,
  next_match_at,
  times_blocked,
  reputation_score,
  quick_exits,
  last_quick_exit,
  username,
  avatar
FROM public.guest_sessions;

-- Grant SELECT to authenticated users
GRANT SELECT ON public.guest_sessions_public TO authenticated;