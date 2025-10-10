-- Drop the restrictive policy that blocks post-disconnect reads
DROP POLICY IF EXISTS "rls_messages_select_simple" ON public.messages;

-- Create new policy allowing reads for both active AND ended rooms
CREATE POLICY "rls_messages_select_final" ON public.messages
FOR SELECT
USING (
  -- User owns the session that sent the message
  session_id IN (
    SELECT id FROM public.guest_sessions
    WHERE user_id = auth.uid()
  )
  OR
  -- User is a participant in the room (active OR ended)
  EXISTS (
    SELECT 1 
    FROM public.chat_rooms cr
    WHERE cr.id = messages.room_id 
      AND cr.status IN ('active', 'ended')
      AND (
        cr.session_a IN (
          SELECT id FROM public.guest_sessions 
          WHERE user_id = auth.uid()
        )
        OR
        cr.session_b IN (
          SELECT id FROM public.guest_sessions 
          WHERE user_id = auth.uid()
        )
      )
  )
);

COMMENT ON POLICY "rls_messages_select_final" ON public.messages IS 
'Allows users to read all messages in rooms they participated in, regardless of room status (active or ended). Enables post-disconnect message visibility and realtime delivery.';