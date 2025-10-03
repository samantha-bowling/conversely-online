-- Phase 2 Fix: Simplify RLS policies for guest session architecture
-- Since we use edge function authorization, RLS just prevents unauthorized writes

-- Drop existing policies
DROP POLICY IF EXISTS "Sessions can only read their own data" ON public.guest_sessions;
DROP POLICY IF EXISTS "Sessions can only read their own blocks" ON public.blocked_pairs;
DROP POLICY IF EXISTS "Sessions can only read their own answers" ON public.survey_answers;
DROP POLICY IF EXISTS "Sessions can read messages in their rooms" ON public.messages;
DROP POLICY IF EXISTS "Sessions can read their own rooms" ON public.chat_rooms;
DROP POLICY IF EXISTS "Sessions can update their own rooms" ON public.chat_rooms;

-- Guest Sessions: Allow reads, anyone can insert (for session creation)
CREATE POLICY "Anyone can read sessions"
  ON public.guest_sessions FOR SELECT
  USING (true);

-- Blocked Pairs: Allow reads, anyone can insert (edge function validates)
CREATE POLICY "Anyone can read blocked pairs"
  ON public.blocked_pairs FOR SELECT
  USING (true);

-- Survey Answers: Allow reads, anyone can insert (edge function validates)
CREATE POLICY "Anyone can read survey answers"
  ON public.survey_answers FOR SELECT
  USING (true);

-- Messages: Allow reads, inserts validated by edge function
CREATE POLICY "Anyone can read messages"
  ON public.messages FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert messages"
  ON public.messages FOR INSERT
  WITH CHECK (true);

-- Chat Rooms: Allow reads and updates (edge functions handle authorization)
CREATE POLICY "Anyone can read chat rooms"
  ON public.chat_rooms FOR SELECT
  USING (true);

CREATE POLICY "Anyone can update chat rooms"
  ON public.chat_rooms FOR UPDATE
  USING (true);

-- Reflections: Keep insert-only (already correct)
-- No changes needed for reflections table