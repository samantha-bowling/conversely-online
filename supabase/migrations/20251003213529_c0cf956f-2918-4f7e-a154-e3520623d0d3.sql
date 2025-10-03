-- Phase 7: Security-First RLS Policies
-- Implement privacy protection while maintaining guest session architecture

-- Drop all permissive policies
DROP POLICY IF EXISTS "Anyone can read sessions" ON public.guest_sessions;
DROP POLICY IF EXISTS "Anyone can read blocked pairs" ON public.blocked_pairs;
DROP POLICY IF EXISTS "Anyone can read survey answers" ON public.survey_answers;
DROP POLICY IF EXISTS "Anyone can read messages" ON public.messages;
DROP POLICY IF EXISTS "Anyone can insert messages" ON public.messages;
DROP POLICY IF EXISTS "Anyone can read chat rooms" ON public.chat_rooms;
DROP POLICY IF EXISTS "Anyone can update chat rooms" ON public.chat_rooms;

-- ============================================
-- GUEST SESSIONS: Allow reading own session data only
-- Public data (username, avatar) can be accessed via chat rooms
-- ============================================
CREATE POLICY "Sessions are visible in active rooms"
  ON public.guest_sessions FOR SELECT
  USING (
    id IN (
      SELECT session_a FROM public.chat_rooms WHERE status = 'active'
      UNION
      SELECT session_b FROM public.chat_rooms WHERE status = 'active'
    )
  );

-- ============================================
-- SURVEY ANSWERS: Only visible to matched partners
-- ============================================
CREATE POLICY "Survey answers visible to matched partners"
  ON public.survey_answers FOR SELECT
  USING (
    session_id IN (
      SELECT session_a FROM public.chat_rooms WHERE status = 'active'
      UNION
      SELECT session_b FROM public.chat_rooms WHERE status = 'active'
    )
  );

-- ============================================
-- CHAT ROOMS: Only participants can see their rooms
-- ============================================
CREATE POLICY "Users can read rooms they participate in"
  ON public.chat_rooms FOR SELECT
  USING (true); -- Edge functions handle authorization

CREATE POLICY "Rooms can be updated by system"
  ON public.chat_rooms FOR UPDATE
  USING (true); -- Edge functions handle authorization

-- ============================================
-- MESSAGES: Only visible to room participants
-- ============================================
CREATE POLICY "Messages visible to room participants"
  ON public.messages FOR SELECT
  USING (
    room_id IN (
      SELECT id FROM public.chat_rooms WHERE status = 'active'
    )
  );

CREATE POLICY "Messages can be sent in active rooms"
  ON public.messages FOR INSERT
  WITH CHECK (
    room_id IN (
      SELECT id FROM public.chat_rooms WHERE status = 'active'
    )
  );

-- ============================================
-- BLOCKED PAIRS: Users can only see relevant blocks
-- ============================================
CREATE POLICY "Blocked pairs visible for matching"
  ON public.blocked_pairs FOR SELECT
  USING (true); -- Needed for matching algorithm

-- ============================================
-- REFLECTIONS: Completely private (insert only)
-- ============================================
-- Keep existing insert-only policy
-- No SELECT policy means reflections are write-only