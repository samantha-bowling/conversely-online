-- Create function to retrieve maintenance logs (bypasses RLS via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_maintenance_logs(_limit integer DEFAULT 10)
RETURNS TABLE(
  id uuid,
  job_name text,
  closed_count integer,
  would_close_count integer,
  safety_clamp_triggered boolean,
  created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    id,
    job_name,
    closed_count,
    would_close_count,
    safety_clamp_triggered,
    created_at
  FROM public.maintenance_logs
  ORDER BY created_at DESC
  LIMIT _limit;
$$;

-- Grant access to authenticated users (password gate still protects the dashboard UI)
GRANT EXECUTE ON FUNCTION public.get_maintenance_logs TO authenticated;