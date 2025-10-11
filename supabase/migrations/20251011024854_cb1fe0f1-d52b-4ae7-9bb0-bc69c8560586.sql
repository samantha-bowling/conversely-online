-- Drop the blocking UPDATE policy
DROP POLICY IF EXISTS "Rooms can only be updated by service" ON public.chat_rooms;

-- Create new policy that allows participants to see room updates
-- but still prevents client-side mutations
CREATE POLICY "Users can see room updates"
ON public.chat_rooms
FOR UPDATE
TO authenticated
USING (
  -- Allow seeing updates for rooms where user is a participant
  session_a IN (
    SELECT id FROM public.guest_sessions 
    WHERE user_id = auth.uid()
  )
  OR session_b IN (
    SELECT id FROM public.guest_sessions 
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (false); -- Still prevent actual client-side updates