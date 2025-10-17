-- Add replay protection column to guest_sessions
ALTER TABLE public.guest_sessions
ADD COLUMN last_validated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Create index for validation queries
CREATE INDEX idx_guest_sessions_validation ON public.guest_sessions(user_id, expires_at, last_validated_at);

-- RLS fallback policy: Only active sessions can be selected
CREATE POLICY "rls_guest_sessions_active_only"
ON public.guest_sessions
FOR SELECT
USING (expires_at > now());

-- Function to revoke expired guest auth sessions
CREATE OR REPLACE FUNCTION public.revoke_expired_guest_auth()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_revoked_count INT;
BEGIN
  -- Delete auth sessions for expired guest_sessions
  DELETE FROM auth.sessions
  WHERE user_id IN (
    SELECT user_id 
    FROM public.guest_sessions 
    WHERE expires_at < now()
  );
  
  GET DIAGNOSTICS v_revoked_count = ROW_COUNT;
  
  -- Log telemetry
  INSERT INTO public.maintenance_logs (job_name, closed_count, would_close_count, safety_clamp_triggered)
  VALUES ('revoke_expired_guest_auth', v_revoked_count, v_revoked_count, false);
  
  RAISE NOTICE '[revoke_expired_guest_auth] Revoked % auth sessions', v_revoked_count;
END;
$$;

-- Create cron job to run auth revocation hourly
SELECT cron.schedule(
  'revoke-expired-guest-auth',
  '0 * * * *', -- Every hour at minute 0
  $$
  SELECT public.revoke_expired_guest_auth();
  $$
);