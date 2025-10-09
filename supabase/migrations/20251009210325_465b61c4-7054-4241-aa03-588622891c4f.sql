-- Phase 1: Fix RLS Policy for Messages (Realtime-friendly)
DROP POLICY IF EXISTS "rls_messages_select_participants_only" ON public.messages;

CREATE POLICY "rls_messages_select_simple" ON public.messages
FOR SELECT
USING (
  -- User owns the session that sent the message
  session_id IN (
    SELECT id FROM public.guest_sessions
    WHERE user_id = auth.uid()
  )
  OR
  -- User is a participant in the room
  EXISTS (
    SELECT 1 
    FROM public.chat_rooms cr
    WHERE cr.id = messages.room_id 
      AND cr.status = 'active'
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

COMMENT ON POLICY "rls_messages_select_simple" ON public.messages IS 
'Simplified policy for Realtime compatibility: allows users to see messages they sent or received in active rooms';

-- Phase 2: Add Test Mode Isolation
ALTER TABLE public.guest_sessions 
ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT false;

-- Partial index for test sessions
CREATE INDEX IF NOT EXISTS idx_guest_sessions_is_test 
ON public.guest_sessions(is_test) 
WHERE is_test = true;

-- Composite index for matching performance
CREATE INDEX IF NOT EXISTS idx_guest_sessions_test_active 
ON public.guest_sessions(is_test, next_match_at, expires_at);

COMMENT ON COLUMN public.guest_sessions.is_test IS 
'Marks test/development sessions that should only match with other test sessions';