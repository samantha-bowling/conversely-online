BEGIN;

-- Step 1: Create optimized security definer function to check session visibility
CREATE OR REPLACE FUNCTION public.can_see_session(_session_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- User owns the session
    SELECT 1 FROM public.guest_sessions gs
    WHERE gs.id = _session_id AND gs.user_id = _user_id
  )
  OR EXISTS (
    -- User is in an active room with this session
    SELECT 1
    FROM public.chat_rooms cr
    JOIN public.guest_sessions gs_self ON gs_self.user_id = _user_id
    WHERE cr.status = 'active'
      AND ((cr.session_a = _session_id AND cr.session_b = gs_self.id)
        OR (cr.session_b = _session_id AND cr.session_a = gs_self.id))
  );
$$;

-- Add maintainability documentation
COMMENT ON FUNCTION public.can_see_session(uuid, uuid)
IS 'Bypasses RLS recursion for guest_sessions visibility. Uses explicit joins for performance. Do not modify without security review.';

-- Grant execution to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION public.can_see_session TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_see_session TO anon;

-- Step 2: Add performance index
CREATE INDEX IF NOT EXISTS idx_guest_sessions_user_id 
ON public.guest_sessions(user_id);

-- Step 3: Drop recursive policies
DROP POLICY IF EXISTS "Users can see own session" ON public.guest_sessions;
DROP POLICY IF EXISTS "Users can see partner session in active rooms" ON public.guest_sessions;

-- Step 4: Create unified, non-recursive policy
CREATE POLICY "Users can see allowed sessions"
ON public.guest_sessions
FOR SELECT
TO authenticated, anon
USING (public.can_see_session(id, auth.uid()));

COMMIT;