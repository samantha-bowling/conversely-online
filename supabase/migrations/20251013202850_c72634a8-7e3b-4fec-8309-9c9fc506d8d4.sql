-- ============================================================================
-- Heartbeat-Based Partner Disconnect Detection
-- Purpose: Detect when chat partner closes browser within ~20-30 seconds
-- Interval Strategy:
--   - Client heartbeat: every 15s
--   - Liveness threshold: 30s (allows for 1 missed heartbeat)
--   - Server cleanup: 2min (both partners) for edge cases
-- ============================================================================

-- Drop existing function if re-running migration
DROP FUNCTION IF EXISTS public.check_partner_heartbeat(UUID, UUID);

-- Create heartbeat check function
CREATE OR REPLACE FUNCTION public.check_partner_heartbeat(
  _room_id UUID,
  _my_session_id UUID
)
RETURNS TABLE(
  partner_alive BOOLEAN,
  partner_session_id UUID,
  last_heartbeat TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _partner_id UUID;
  _partner_heartbeat TIMESTAMPTZ;
BEGIN
  -- Get partner's session ID
  SELECT CASE 
    WHEN session_a = _my_session_id THEN session_b
    WHEN session_b = _my_session_id THEN session_a
  END INTO _partner_id
  FROM public.chat_rooms
  WHERE id = _room_id;

  -- Guard against orphaned/deleted rooms
  IF _partner_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  -- Get partner's last heartbeat
  SELECT last_heartbeat_at INTO _partner_heartbeat
  FROM public.guest_sessions
  WHERE id = _partner_id;

  -- Return liveness check (fresh if < 30 seconds old)
  RETURN QUERY SELECT 
    (_partner_heartbeat > now() - interval '30 seconds'),
    _partner_id,
    _partner_heartbeat;
END;
$$;

COMMENT ON FUNCTION public.check_partner_heartbeat IS 
'Checks if chat partner''s heartbeat is fresh (<30s) for disconnect detection. Used by polling fallback in useChatRealtime.ts.';

-- ============================================================================
-- Enhanced Server-Side Cleanup
-- ============================================================================

CREATE OR REPLACE FUNCTION public.close_inactive_rooms()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Original logic: Close rooms with stale last_activity (5 min)
  UPDATE public.chat_rooms cr
  SET status = 'ended', ended_at = now()
  WHERE status = 'active'
    AND last_activity < (now() - interval '5 minutes');

  -- Also close rooms where BOTH heartbeats are stale (2 min)
  -- NOTE: 2min threshold is deliberate - allows client-side detection first
  UPDATE public.chat_rooms cr
  SET status = 'ended', ended_at = now()
  WHERE status = 'active'
    AND EXISTS (
      SELECT 1 FROM guest_sessions gs_a
      WHERE gs_a.id = cr.session_a
        AND gs_a.last_heartbeat_at < (now() - interval '2 minutes')
    )
    AND EXISTS (
      SELECT 1 FROM guest_sessions gs_b
      WHERE gs_b.id = cr.session_b
        AND gs_b.last_heartbeat_at < (now() - interval '2 minutes')
    );
END;
$$;

COMMENT ON FUNCTION public.close_inactive_rooms IS 
'Closes rooms inactive for 5min OR where both partners have stale heartbeats (>2min). Runs via scheduled cron job.';