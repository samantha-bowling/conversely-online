-- Create guest_sessions table
CREATE TABLE public.guest_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL,
  avatar TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  next_match_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.guest_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own session"
ON public.guest_sessions FOR SELECT
USING (true);

CREATE POLICY "Anyone can insert sessions"
ON public.guest_sessions FOR INSERT
WITH CHECK (true);

-- Create survey_answers table
CREATE TABLE public.survey_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.guest_sessions(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.survey_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert survey answers"
ON public.survey_answers FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can read survey answers"
ON public.survey_answers FOR SELECT
USING (true);

-- Create chat_rooms table
CREATE TABLE public.chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_a UUID NOT NULL REFERENCES public.guest_sessions(id) ON DELETE CASCADE,
  session_b UUID NOT NULL REFERENCES public.guest_sessions(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);

ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own rooms"
ON public.chat_rooms FOR SELECT
USING (true);

CREATE POLICY "Anyone can insert rooms"
ON public.chat_rooms FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can update their own rooms"
ON public.chat_rooms FOR UPDATE
USING (true);

-- Create messages table
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.guest_sessions(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '60 seconds')
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read messages in their rooms"
ON public.messages FOR SELECT
USING (true);

CREATE POLICY "Users can insert messages"
ON public.messages FOR INSERT
WITH CHECK (true);

-- Enable realtime for messages and chat_rooms
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_rooms;

-- Create reflections table
CREATE TABLE public.reflections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.guest_sessions(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reflections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert reflections"
ON public.reflections FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can read reflections"
ON public.reflections FOR SELECT
USING (true);

-- Create blocked_pairs table
CREATE TABLE public.blocked_pairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_a UUID NOT NULL REFERENCES public.guest_sessions(id) ON DELETE CASCADE,
  session_b UUID NOT NULL REFERENCES public.guest_sessions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_a, session_b)
);

ALTER TABLE public.blocked_pairs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert blocked pairs"
ON public.blocked_pairs FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can read blocked pairs"
ON public.blocked_pairs FOR SELECT
USING (true);

-- Auto-cleanup function for expired sessions
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.guest_sessions
  WHERE expires_at < now();
END;
$$;

-- Auto-cleanup function for expired messages
CREATE OR REPLACE FUNCTION public.cleanup_expired_messages()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.messages
  WHERE expires_at < now();
END;
$$;

-- Function to close inactive rooms
CREATE OR REPLACE FUNCTION public.close_inactive_rooms()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.chat_rooms
  SET status = 'ended', ended_at = now()
  WHERE status = 'active'
    AND last_activity < (now() - interval '5 minutes');
END;
$$;