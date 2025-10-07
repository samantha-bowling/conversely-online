-- Phase 1: Add user_id to guest_sessions for anonymous auth integration
-- This column is nullable to allow existing sessions to continue working during migration

ALTER TABLE public.guest_sessions 
ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for performance when looking up sessions by user_id
CREATE INDEX idx_guest_sessions_user_id ON public.guest_sessions(user_id);

-- Add comment for documentation
COMMENT ON COLUMN public.guest_sessions.user_id IS 'Links guest session to anonymous auth user for proper RLS security';