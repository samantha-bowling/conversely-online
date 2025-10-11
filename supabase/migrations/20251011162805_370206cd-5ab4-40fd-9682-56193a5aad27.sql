-- ========================================
-- Phase 1: Drop guest_sessions_public view
-- ========================================
-- This view is no longer needed as match-opposite now queries guest_sessions directly
-- with proper RLS policies enforced.

DROP VIEW IF EXISTS public.guest_sessions_public;

-- Ensure direct SELECT access to guest_sessions table
GRANT SELECT ON public.guest_sessions TO authenticated, anon;

-- Add documentation comment
COMMENT ON TABLE public.guest_sessions IS 'Guest sessions with RLS policies. All access should be direct to this table, not through views.';