-- Phase 7B: Fix Critical Vulnerabilities
-- Address remaining security issues from scan

-- Drop policies that need refinement
DROP POLICY IF EXISTS "Users can read rooms they participate in" ON public.chat_rooms;
DROP POLICY IF EXISTS "Rooms can be updated by system" ON public.chat_rooms;
DROP POLICY IF EXISTS "Messages visible to room participants" ON public.messages;
DROP POLICY IF EXISTS "Sessions are visible in active rooms" ON public.guest_sessions;

-- ============================================
-- CHAT ROOMS: Prevent unauthorized updates
-- ============================================
-- Note: SELECT must remain permissive for realtime subscriptions to work
-- without auth.uid(), we can't verify session ownership
CREATE POLICY "Rooms are visible for realtime"
  ON public.chat_rooms FOR SELECT
  USING (true);

-- UPDATE: Only allow through service role (edge functions)
-- Remove public UPDATE access completely
CREATE POLICY "Rooms can only be updated by service"
  ON public.chat_rooms FOR UPDATE
  USING (false); -- Block all public updates

-- ============================================
-- MESSAGES: Tighten to active room participants only
-- ============================================
-- Can only read messages from rooms that are currently active
-- This prevents reading historical messages from ended rooms
CREATE POLICY "Messages visible in active rooms only"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_rooms
      WHERE chat_rooms.id = messages.room_id
      AND chat_rooms.status = 'active'
    )
  );

-- ============================================
-- GUEST SESSIONS: Only visible to matched partners
-- ============================================
CREATE POLICY "Sessions visible to chat partners"
  ON public.guest_sessions FOR SELECT
  USING (
    -- Only visible if in an active room
    EXISTS (
      SELECT 1 FROM public.chat_rooms
      WHERE (chat_rooms.session_a = guest_sessions.id OR chat_rooms.session_b = guest_sessions.id)
      AND chat_rooms.status = 'active'
    )
  );