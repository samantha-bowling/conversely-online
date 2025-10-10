-- Drop any existing policies to ensure clean state
DROP POLICY IF EXISTS "rls_messages_select_final" ON public.messages;
DROP POLICY IF EXISTS "rls_messages_select_simplified" ON public.messages;

-- Create new simplified policy without circular RLS dependencies
CREATE POLICY "rls_messages_select_simplified" 
ON public.messages
FOR SELECT
TO public  -- Matches existing policy scope (all roles: anon + authenticated)
USING (
  -- Can see own messages (session belongs to this user)
  session_id IN (
    SELECT id FROM public.guest_sessions 
    WHERE user_id = auth.uid()
  )
  OR
  -- Can see messages in rooms where user is a participant
  -- Uses direct JOINs to avoid circular RLS evaluation
  room_id IN (
    SELECT cr.id
    FROM public.chat_rooms cr
    INNER JOIN public.guest_sessions gs_a ON cr.session_a = gs_a.id
    INNER JOIN public.guest_sessions gs_b ON cr.session_b = gs_b.id
    WHERE cr.status IN ('active', 'ended')
      AND (gs_a.user_id = auth.uid() OR gs_b.user_id = auth.uid())
  )
);

COMMENT ON POLICY "rls_messages_select_simplified" ON public.messages IS
'Allows each user (anonymous or authenticated) to see messages in rooms they participate in. Uses direct JOINs to avoid circular RLS dependencies with guest_sessions table. Safe for both active and ended rooms.';