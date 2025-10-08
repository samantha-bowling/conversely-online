BEGIN;

-- Clean orphans before enforcing integrity
DELETE FROM public.guest_sessions WHERE user_id IS NULL;

-- Remove legacy trigger/function if they exist
DROP TRIGGER IF EXISTS trg_set_guest_session_user_id ON public.guest_sessions;
DROP FUNCTION IF EXISTS public.set_guest_session_user_id();

-- Make DB derive identity from the JWT
ALTER TABLE public.guest_sessions
  ALTER COLUMN user_id DROP DEFAULT,
  ALTER COLUMN user_id SET DEFAULT auth.uid();

-- Enforce integrity
ALTER TABLE public.guest_sessions
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.guest_sessions
  DROP CONSTRAINT IF EXISTS guest_sessions_user_fk,
  ADD CONSTRAINT guest_sessions_user_fk
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

COMMIT;