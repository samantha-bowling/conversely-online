-- Fix ambiguous column reference in atomic_create_match_room function
-- Issue: RETURNS TABLE declares 'status' column, and chat_rooms table also has 'status' column
-- Solution: Fully qualify all status column references with table alias 'cr'

CREATE OR REPLACE FUNCTION public.atomic_create_match_room(_session_a uuid, _session_b uuid)
 RETURNS TABLE(room_id uuid, status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  SELECT cr.id INTO _existing_room
  FROM chat_rooms cr
  WHERE (cr.session_a = _session_a OR cr.session_b = _session_a)
    AND cr.status = 'active'
  LIMIT 1;

  IF _existing_room IS NOT NULL THEN
    -- Current user already matched - return their existing room
    RETURN QUERY SELECT _existing_room, 'session_a_busy'::text;
    RETURN;
  END IF;

  -- Check if session_b is already in an active room
  SELECT cr.id INTO _existing_room
  FROM chat_rooms cr
  WHERE (cr.session_a = _session_b OR cr.session_b = _session_b)
    AND cr.status = 'active'
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
$function$;