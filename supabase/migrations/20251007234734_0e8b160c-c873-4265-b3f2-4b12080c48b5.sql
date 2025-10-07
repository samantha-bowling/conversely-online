-- Phase 4: Implement proper RLS policies with auth.uid()
-- This migration secures all tables to prevent data leakage

-- ============================================
-- 1. Fix guest_sessions visibility
-- ============================================

-- Drop old permissive policy
DROP POLICY IF EXISTS "Sessions visible to chat partners" ON public.guest_sessions;

-- Users can see their own session
CREATE POLICY "Users can see own session"
  ON public.guest_sessions FOR SELECT
  USING (user_id = auth.uid());

-- Users can see partner session in active rooms only
CREATE POLICY "Users can see partner session in active rooms"
  ON public.guest_sessions FOR SELECT
  USING (
    id IN (
      SELECT CASE 
        WHEN cr.session_a = (SELECT id FROM guest_sessions WHERE user_id = auth.uid())
        THEN cr.session_b
        WHEN cr.session_b = (SELECT id FROM guest_sessions WHERE user_id = auth.uid())
        THEN cr.session_a
      END
      FROM chat_rooms cr
      WHERE cr.status = 'active'
    )
  );

-- ============================================
-- 2. Fix chat_rooms visibility (CRITICAL)
-- ============================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Rooms are visible for realtime" ON public.chat_rooms;

-- Users can only see their own rooms
CREATE POLICY "Users can only see their own rooms"
  ON public.chat_rooms FOR SELECT
  USING (
    session_a IN (SELECT id FROM guest_sessions WHERE user_id = auth.uid())
    OR
    session_b IN (SELECT id FROM guest_sessions WHERE user_id = auth.uid())
  );

-- ============================================
-- 3. Fix survey_answers visibility
-- ============================================

-- Drop old permissive policy
DROP POLICY IF EXISTS "Survey answers visible to matched partners" ON public.survey_answers;

-- Users can see their own answers
CREATE POLICY "Users can see own answers"
  ON public.survey_answers FOR SELECT
  USING (
    session_id IN (SELECT id FROM guest_sessions WHERE user_id = auth.uid())
  );

-- Users can see partner answers in active rooms only
CREATE POLICY "Users can see partner answers in active rooms"
  ON public.survey_answers FOR SELECT
  USING (
    session_id IN (
      SELECT CASE 
        WHEN cr.session_a = (SELECT id FROM guest_sessions WHERE user_id = auth.uid())
        THEN cr.session_b
        WHEN cr.session_b = (SELECT id FROM guest_sessions WHERE user_id = auth.uid())
        THEN cr.session_a
      END
      FROM chat_rooms cr
      WHERE cr.status = 'active'
    )
  );

-- ============================================
-- 4. Fix messages INSERT (prevents impersonation)
-- ============================================

-- Drop old permissive policies
DROP POLICY IF EXISTS "Sessions can insert messages in their rooms" ON public.messages;
DROP POLICY IF EXISTS "Messages can be sent in active rooms" ON public.messages;

-- Users can only send messages as themselves in their active rooms
CREATE POLICY "Users can only send messages as themselves"
  ON public.messages FOR INSERT
  WITH CHECK (
    session_id IN (SELECT id FROM guest_sessions WHERE user_id = auth.uid())
    AND room_id IN (
      SELECT cr.id FROM chat_rooms cr
      WHERE cr.status = 'active'
        AND (
          cr.session_a = session_id
          OR cr.session_b = session_id
        )
    )
  );

-- ============================================
-- 5. Fix blocked_pairs visibility (already secure)
-- ============================================

-- Verify blocked_pairs has no client SELECT access
DROP POLICY IF EXISTS "Blocked pairs visible for matching" ON public.blocked_pairs;

CREATE POLICY "No client SELECT on blocked_pairs"
  ON public.blocked_pairs FOR SELECT
  USING (false);

-- ============================================
-- Security verification comments
-- ============================================

COMMENT ON POLICY "Users can see own session" ON public.guest_sessions IS 
  'Security: Users can only see their own guest session data';

COMMENT ON POLICY "Users can see partner session in active rooms" ON public.guest_sessions IS 
  'Security: Users can only see their matched partner session data in active chats';

COMMENT ON POLICY "Users can only see their own rooms" ON public.chat_rooms IS 
  'Security: Prevents users from seeing all chat rooms - only their own';

COMMENT ON POLICY "Users can see own answers" ON public.survey_answers IS 
  'Security: Users can only see their own survey answers';

COMMENT ON POLICY "Users can see partner answers in active rooms" ON public.survey_answers IS 
  'Security: Users can only see their matched partner survey answers in active chats';

COMMENT ON POLICY "Users can only send messages as themselves" ON public.messages IS 
  'Security: Prevents message impersonation - validates session_id matches authenticated user';

COMMENT ON POLICY "No client SELECT on blocked_pairs" ON public.blocked_pairs IS 
  'Security: Blocking history completely hidden from clients - server-side only';