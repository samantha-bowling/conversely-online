-- Migration: production_rls_hardening_v2
-- Refinements based on security audit feedback

-- ============================================================
-- PHASE 1: CRITICAL FIXES
-- ============================================================

-- 1. Survey Answers (CRITICAL - Exploit Prevention)
DROP POLICY IF EXISTS "Anyone can insert survey answers" ON survey_answers;
CREATE POLICY "rls_survey_answers_insert_own"
ON survey_answers FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM guest_sessions gs
    WHERE gs.id = survey_answers.session_id
    AND gs.user_id = auth.uid()
  )
);

-- 2. Messages SELECT (Active Room Snooping Prevention)
DROP POLICY IF EXISTS "Messages visible in active rooms only" ON messages;
CREATE POLICY "rls_messages_select_participants_only"
ON messages FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM chat_rooms cr
    JOIN guest_sessions gs ON gs.user_id = auth.uid()
    WHERE cr.id = messages.room_id
      AND cr.status = 'active'
      AND (cr.session_a = gs.id OR cr.session_b = gs.id)
  )
);

-- 3. Chat Rooms INSERT (Defense-in-Depth)
DROP POLICY IF EXISTS "Anyone can insert rooms" ON chat_rooms;
CREATE POLICY "rls_chat_rooms_insert_own_sessions"
ON chat_rooms FOR INSERT
WITH CHECK (
  (
    session_a IN (
      SELECT id FROM guest_sessions 
      WHERE user_id = auth.uid()
    )
  )
  OR
  (
    session_b IN (
      SELECT id FROM guest_sessions 
      WHERE user_id = auth.uid()
    )
  )
);

-- ============================================================
-- PHASE 2: HIGH PRIORITY HARDENING
-- ============================================================

-- 4. Blocked Pairs INSERT
DROP POLICY IF EXISTS "Anyone can insert blocked pairs" ON blocked_pairs;
CREATE POLICY "rls_blocked_pairs_insert_own_session"
ON blocked_pairs FOR INSERT
WITH CHECK (
  session_a IN (
    SELECT id FROM guest_sessions 
    WHERE user_id = auth.uid()
  )
);

-- 5. Guest Sessions Public View (user_id exposure prevention)
CREATE VIEW guest_sessions_public AS
SELECT 
  id, created_at, expires_at, next_match_at,
  times_blocked, reputation_score, quick_exits,
  last_quick_exit, username, avatar
FROM guest_sessions;

-- Grant access to view
GRANT SELECT ON guest_sessions_public TO authenticated, anon;

-- Revoke direct table access (keep service_role implicit access)
REVOKE SELECT ON guest_sessions FROM authenticated;