-- Create telemetry table for maintenance job tracking
CREATE TABLE public.maintenance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  closed_count INTEGER NOT NULL DEFAULT 0,
  would_close_count INTEGER NOT NULL DEFAULT 0,
  safety_clamp_triggered BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_maintenance_logs_created_at ON public.maintenance_logs(created_at DESC);

COMMENT ON TABLE public.maintenance_logs IS 'Tracks maintenance job execution metrics for observability';

-- Enable RLS (no client access needed)
ALTER TABLE public.maintenance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No client access to maintenance_logs" ON public.maintenance_logs
  FOR ALL USING (false);

-- Enhanced close_inactive_rooms with safety clamp and telemetry
CREATE OR REPLACE FUNCTION public.close_inactive_rooms()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_would_close_activity INT;
  v_would_close_heartbeat INT;
  v_total_would_close INT;
  v_actually_closed INT;
  v_safety_clamp BOOLEAN := false;
BEGIN
  -- Count rooms that would be closed by last_activity rule
  SELECT COUNT(*) INTO v_would_close_activity
  FROM public.chat_rooms
  WHERE status = 'active'
    AND last_activity < (now() - interval '5 minutes');

  -- Count rooms that would be closed by dual-heartbeat rule
  SELECT COUNT(*) INTO v_would_close_heartbeat
  FROM public.chat_rooms cr
  WHERE status = 'active'
    AND EXISTS (
      SELECT 1 FROM guest_sessions gs_a
      WHERE gs_a.id = cr.session_a
        AND gs_a.last_heartbeat_at < (now() - interval '120 seconds')
    )
    AND EXISTS (
      SELECT 1 FROM guest_sessions gs_b
      WHERE gs_b.id = cr.session_b
        AND gs_b.last_heartbeat_at < (now() - interval '120 seconds')
    );

  v_total_would_close := v_would_close_activity + v_would_close_heartbeat;

  -- Safety clamp: abort if >100 rooms eligible
  IF v_total_would_close > 100 THEN
    RAISE WARNING '[close_inactive_rooms] Safety clamp triggered: % rooms eligible (max 100). Aborting cleanup.', v_total_would_close;
    v_safety_clamp := true;
    
    -- Log clamp trigger
    INSERT INTO public.maintenance_logs (job_name, would_close_count, closed_count, safety_clamp_triggered)
    VALUES ('close_inactive_rooms', v_total_would_close, 0, true);
    
    RETURN;
  END IF;

  -- Close rooms with stale last_activity (5 min)
  -- SYNC: This catches rooms where message activity expired
  UPDATE public.chat_rooms cr
  SET status = 'ended', ended_at = now()
  WHERE status = 'active'
    AND last_activity < (now() - interval '5 minutes');

  -- Close rooms where BOTH heartbeats are stale
  -- SYNC: 120s = 4× CHAT_HEARTBEAT_TTL_MS (30s)
  -- Rationale: Client detects disconnect at 30s, server cleanup runs at 120s
  -- Buffer prevents premature closure during transient network issues
  UPDATE public.chat_rooms cr
  SET status = 'ended', ended_at = now()
  WHERE status = 'active'
    AND EXISTS (
      SELECT 1 FROM guest_sessions gs_a
      WHERE gs_a.id = cr.session_a
        AND gs_a.last_heartbeat_at < (now() - interval '120 seconds')
    )
    AND EXISTS (
      SELECT 1 FROM guest_sessions gs_b
      WHERE gs_b.id = cr.session_b
        AND gs_b.last_heartbeat_at < (now() - interval '120 seconds')
    );

  -- Count actually closed rooms (for telemetry)
  SELECT COUNT(*) INTO v_actually_closed
  FROM public.chat_rooms
  WHERE status = 'ended'
    AND ended_at > now() - interval '10 seconds';

  -- Log successful cleanup
  INSERT INTO public.maintenance_logs (job_name, would_close_count, closed_count, safety_clamp_triggered)
  VALUES ('close_inactive_rooms', v_total_would_close, v_actually_closed, false);

END;
$$;

COMMENT ON FUNCTION public.close_inactive_rooms IS 
'Closes rooms inactive for 5min OR where both partners have stale heartbeats (>120s = 4× CHAT_HEARTBEAT_TTL). Includes safety clamp (max 100 per run) and telemetry logging. Runs via scheduled cron every 5 minutes.';

-- Optional: Cleanup old telemetry logs (keep 90 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_maintenance_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.maintenance_logs
  WHERE created_at < now() - interval '90 days';
END;
$$;