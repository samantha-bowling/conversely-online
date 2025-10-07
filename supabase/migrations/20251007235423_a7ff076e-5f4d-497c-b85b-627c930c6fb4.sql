-- Phase 5: Close RLS Policy Gaps
-- Add explicit denial policies for UPDATE and DELETE operations
-- All mutations must go through Edge Functions with service role

-- guest_sessions: Deny UPDATE and DELETE from clients
CREATE POLICY "No client UPDATE on guest_sessions"
ON public.guest_sessions
FOR UPDATE
TO authenticated
USING (false);

CREATE POLICY "No client DELETE on guest_sessions"
ON public.guest_sessions
FOR DELETE
TO authenticated
USING (false);

-- survey_answers: Deny UPDATE and DELETE from clients (answers are immutable)
CREATE POLICY "No client UPDATE on survey_answers"
ON public.survey_answers
FOR UPDATE
TO authenticated
USING (false);

CREATE POLICY "No client DELETE on survey_answers"
ON public.survey_answers
FOR DELETE
TO authenticated
USING (false);

-- messages: Deny UPDATE and DELETE from clients (messages are immutable)
CREATE POLICY "No client UPDATE on messages"
ON public.messages
FOR UPDATE
TO authenticated
USING (false);

CREATE POLICY "No client DELETE on messages"
ON public.messages
FOR DELETE
TO authenticated
USING (false);

-- blocked_pairs: Deny UPDATE and DELETE from clients (blocking is permanent)
CREATE POLICY "No client UPDATE on blocked_pairs"
ON public.blocked_pairs
FOR UPDATE
TO authenticated
USING (false);

CREATE POLICY "No client DELETE on blocked_pairs"
ON public.blocked_pairs
FOR DELETE
TO authenticated
USING (false);

-- chat_rooms: Deny DELETE from clients (rooms are historical records)
CREATE POLICY "No client DELETE on chat_rooms"
ON public.chat_rooms
FOR DELETE
TO authenticated
USING (false);