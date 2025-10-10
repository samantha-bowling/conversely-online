-- Part 1: Database-level enforcement - prevent sessions in multiple active rooms
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_rooms_unique_session_a 
ON public.chat_rooms (session_a) 
WHERE status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_rooms_unique_session_b 
ON public.chat_rooms (session_b) 
WHERE status = 'active';

COMMENT ON INDEX idx_chat_rooms_unique_session_a IS 
'Ensures session_a cannot appear in multiple active rooms. Database-level race condition protection.';

COMMENT ON INDEX idx_chat_rooms_unique_session_b IS 
'Ensures session_b cannot appear in multiple active rooms. Database-level race condition protection.';

-- Part 2: Atomic match operation using advisory locks
CREATE OR REPLACE FUNCTION public.atomic_create_match_room(
  _session_a uuid,
  _session_b uuid
)
RETURNS TABLE(room_id uuid, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _room_id uuid;
  _lock_id_1 bigint;
  _lock_id_2 bigint;
  _existing_room uuid;
BEGIN
  -- Convert UUIDs to bigint for advisory locks (use hash of first 15 hex chars)
  -- CRITICAL: Sort lock acquisition to prevent deadlocks
  IF _session_a < _session_b THEN
    _lock_id_1 := ('x' || substring(md5(_session_a::text) from 1 for 15))::bit(60)::bigint;
    _lock_id_2 := ('x' || substring(md5(_session_b::text) from 1 for 15))::bit(60)::bigint;
  ELSE
    _lock_id_1 := ('x' || substring(md5(_session_b::text) from 1 for 15))::bit(60)::bigint;
    _lock_id_2 := ('x' || substring(md5(_session_a::text) from 1 for 15))::bit(60)::bigint;
  END IF;

  -- Acquire advisory locks (released at transaction end)
  PERFORM pg_advisory_xact_lock(_lock_id_1);
  PERFORM pg_advisory_xact_lock(_lock_id_2);

  -- Check if session_a is already in an active room
  SELECT id INTO _existing_room
  FROM chat_rooms
  WHERE (session_a = _session_a OR session_b = _session_a)
    AND status = 'active'
  LIMIT 1;

  IF _existing_room IS NOT NULL THEN
    -- Current user already matched - return their existing room
    RETURN QUERY SELECT _existing_room, 'session_a_busy'::text;
    RETURN;
  END IF;

  -- Check if session_b is already in an active room
  SELECT id INTO _existing_room
  FROM chat_rooms
  WHERE (session_a = _session_b OR session_b = _session_b)
    AND status = 'active'
  LIMIT 1;

  IF _existing_room IS NOT NULL THEN
    -- Best match is busy - signal to find another match
    RETURN QUERY SELECT _existing_room, 'session_b_busy'::text;
    RETURN;
  END IF;

  -- Both sessions are free - create the room with canonical ordering
  INSERT INTO chat_rooms (session_a, session_b)
  VALUES (
    LEAST(_session_a, _session_b),
    GREATEST(_session_a, _session_b)
  )
  RETURNING id INTO _room_id;

  RETURN QUERY SELECT _room_id, 'created'::text;
END;
$$;

COMMENT ON FUNCTION public.atomic_create_match_room IS
'Atomically creates a match room between two sessions using advisory locks.
Returns: (room_id, status) where status is:
  - "created": New room created successfully
  - "session_a_busy": Current user already in active room (return existing room_id)
  - "session_b_busy": Best match already in active room (should find new match)
Uses sorted lock acquisition to prevent deadlocks.';

-- Part 3: Cleanup the existing duplicate room
UPDATE public.chat_rooms 
SET status = 'ended', ended_at = NOW()
WHERE id = '52f22bbd-a96d-4a1a-aa67-3117904d183c'
AND status = 'active';