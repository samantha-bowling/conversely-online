-- ============================================
-- Fix guest_sessions architecture
-- Auto-set user_id from JWT and enforce integrity
-- ============================================

-- Step 1: Create trigger function to auto-set user_id from auth.uid()
CREATE OR REPLACE FUNCTION public.set_guest_session_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Auto-set user_id from JWT context if not provided
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;

  -- Enforce that user_id must be set (from JWT)
  IF NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'user_id cannot be NULL - missing authentication context';
  END IF;

  RETURN NEW;
END;
$$;

-- Step 2: Create trigger on guest_sessions
DROP TRIGGER IF EXISTS trg_set_guest_session_user_id ON public.guest_sessions;

CREATE TRIGGER trg_set_guest_session_user_id
BEFORE INSERT ON public.guest_sessions
FOR EACH ROW
EXECUTE FUNCTION public.set_guest_session_user_id();

-- Step 3: Clean up orphaned sessions (NULL user_id)
-- These were created with the broken architecture
DELETE FROM public.guest_sessions WHERE user_id IS NULL;

-- Step 4: Enforce data integrity with NOT NULL constraint
ALTER TABLE public.guest_sessions
  ALTER COLUMN user_id SET NOT NULL;

-- Step 5: Ensure FK constraint exists (may already be present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'guest_sessions_user_fk'
  ) THEN
    ALTER TABLE public.guest_sessions
      ADD CONSTRAINT guest_sessions_user_fk
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON FUNCTION public.set_guest_session_user_id() IS 
  'Automatically sets user_id from auth.uid() on insert. Prevents creating sessions without proper authentication context.';

COMMENT ON TRIGGER trg_set_guest_session_user_id ON public.guest_sessions IS
  'Enforces that all guest sessions are linked to an authenticated user via JWT context.';