BEGIN;

-- ============================================================================
-- PHASE 2: Fix INSERT Policy for Anonymous Authentication
-- ============================================================================

-- Step 1: Revoke default public grants as security safeguard
REVOKE ALL ON TABLE public.guest_sessions FROM PUBLIC;

-- Step 2: Drop old INSERT policy that was scoped to 'public' role
DROP POLICY IF EXISTS "Anyone can insert sessions" ON public.guest_sessions;

-- Step 3: Create new INSERT policy for authenticated and anonymous users
CREATE POLICY "Anyone can insert sessions"
ON public.guest_sessions
FOR INSERT
TO authenticated, anon
WITH CHECK (true);

-- Step 4: Add maintainability comment
COMMENT ON POLICY "Anyone can insert sessions" ON public.guest_sessions
IS 'Allows session creation for anonymous and authenticated users. Required for signInAnonymously() flow in create-guest-session edge function.';

COMMIT;