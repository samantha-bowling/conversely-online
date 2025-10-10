-- Drop any existing message SELECT policies
DROP POLICY IF EXISTS "rls_messages_select_final" ON public.messages;
DROP POLICY IF EXISTS "rls_messages_select_simplified" ON public.messages;
DROP POLICY IF EXISTS "rls_messages_select_minimal" ON public.messages;

-- Create minimal policy without circular dependencies
CREATE POLICY "rls_messages_select_minimal"
ON public.messages
FOR SELECT
TO authenticated, anon
USING (
  auth.uid() IN (
    SELECT gs.user_id
    FROM public.chat_rooms cr
    JOIN public.guest_sessions gs
      ON gs.id IN (cr.session_a, cr.session_b)
    WHERE cr.id = messages.room_id
      AND cr.status IN ('active','ended')
  )
);

COMMENT ON POLICY "rls_messages_select_minimal" ON public.messages IS
'Users can only see messages from rooms where they are a participant. Uses direct room lookup to avoid circular RLS dependencies.';