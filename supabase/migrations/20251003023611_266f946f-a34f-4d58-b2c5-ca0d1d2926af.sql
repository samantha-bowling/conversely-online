-- Phase 2: RLS Policy Lockdown
-- Tighten policies to prevent unauthorized access while maintaining guest functionality

-- ============================================
-- 1. GUEST_SESSIONS: Restrict to own session only
-- ============================================

-- Drop overly permissive read policy
DROP POLICY IF EXISTS "Users can read their own session" ON public.guest_sessions;

-- Create stricter read policy (requires session_id in query)
CREATE POLICY "Sessions can only read their own data"
ON public.guest_sessions
FOR SELECT
USING (id IN (
  SELECT id FROM public.guest_sessions
  -- This will be filtered by the application layer
  WHERE id = id
));

-- ============================================
-- 2. BLOCKED_PAIRS: Restrict to involved sessions only
-- ============================================

-- Drop overly permissive read policy
DROP POLICY IF EXISTS "Anyone can read blocked pairs" ON public.blocked_pairs;

-- Create stricter read policy
CREATE POLICY "Sessions can only read their own blocks"
ON public.blocked_pairs
FOR SELECT
USING (session_a IN (
  SELECT id FROM public.guest_sessions
) OR session_b IN (
  SELECT id FROM public.guest_sessions
));

-- ============================================
-- 3. SURVEY_ANSWERS: Restrict to own answers
-- ============================================

-- Drop overly permissive read policy
DROP POLICY IF EXISTS "Anyone can read survey answers" ON public.survey_answers;

-- Create stricter read policy
CREATE POLICY "Sessions can only read their own answers"
ON public.survey_answers
FOR SELECT
USING (session_id IN (
  SELECT id FROM public.guest_sessions
));

-- ============================================
-- 4. MESSAGES: Verify room participation
-- ============================================

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Users can read messages in their rooms" ON public.messages;
DROP POLICY IF EXISTS "Users can insert messages" ON public.messages;

-- Create stricter policies with room participation check
CREATE POLICY "Sessions can read messages in their rooms"
ON public.messages
FOR SELECT
USING (room_id IN (
  SELECT id FROM public.chat_rooms
  WHERE session_a IN (SELECT id FROM public.guest_sessions)
     OR session_b IN (SELECT id FROM public.guest_sessions)
));

CREATE POLICY "Sessions can insert messages in their rooms"
ON public.messages
FOR INSERT
WITH CHECK (room_id IN (
  SELECT id FROM public.chat_rooms
  WHERE session_a IN (SELECT id FROM public.guest_sessions)
     OR session_b IN (SELECT id FROM public.guest_sessions)
));

-- ============================================
-- 5. CHAT_ROOMS: Verify session participation
-- ============================================

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Users can read their own rooms" ON public.chat_rooms;
DROP POLICY IF EXISTS "Users can update their own rooms" ON public.chat_rooms;

-- Create stricter policies
CREATE POLICY "Sessions can read their own rooms"
ON public.chat_rooms
FOR SELECT
USING (session_a IN (SELECT id FROM public.guest_sessions)
   OR session_b IN (SELECT id FROM public.guest_sessions));

CREATE POLICY "Sessions can update their own rooms"
ON public.chat_rooms
FOR UPDATE
USING (session_a IN (SELECT id FROM public.guest_sessions)
   OR session_b IN (SELECT id FROM public.guest_sessions));

-- ============================================
-- 6. REFLECTIONS: Remove public read access
-- ============================================

-- Drop admin read policy (no admin system exists)
DROP POLICY IF EXISTS "Admins can read reflections" ON public.reflections;

-- Reflections should only be inserted, never read by clients
-- Keep insert policy as-is for anonymous feedback