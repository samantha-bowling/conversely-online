-- Phase 1: Enable REPLICA IDENTITY FULL for realtime messaging
-- This ensures UPDATE events contain full row data, not just id
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.chat_rooms REPLICA IDENTITY FULL;

-- Phase 4: Create reflections table for post-chat feedback
CREATE TABLE public.reflections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES guest_sessions(id) ON DELETE CASCADE,
  rating integer CHECK (rating >= 1 AND rating <= 5),
  feedback text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (room_id, session_id)
);

-- Enable RLS on reflections
ALTER TABLE public.reflections ENABLE ROW LEVEL SECURITY;

-- Users can insert their own reflections
CREATE POLICY "Users can insert own reflections"
  ON public.reflections FOR INSERT
  WITH CHECK (
    session_id IN (
      SELECT id FROM guest_sessions WHERE user_id = auth.uid()
    )
  );

-- Users can view their own reflections
CREATE POLICY "Users can view own reflections"
  ON public.reflections FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM guest_sessions WHERE user_id = auth.uid()
    )
  );

-- No client updates or deletes
CREATE POLICY "No client UPDATE on reflections"
  ON public.reflections FOR UPDATE
  USING (false);

CREATE POLICY "No client DELETE on reflections"
  ON public.reflections FOR DELETE
  USING (false);