-- Health snapshot function for admin dashboard
CREATE OR REPLACE FUNCTION get_health_snapshot()
RETURNS TABLE (
  active_sessions BIGINT,
  searching_users BIGINT,
  active_chats BIGINT,
  recent_messages BIGINT,
  users_online_now BIGINT,
  last_cron_run TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    (SELECT COUNT(*) FROM guest_sessions WHERE expires_at > now()),
    (SELECT COUNT(*) FROM guest_sessions WHERE is_searching = true),
    (SELECT COUNT(*) FROM chat_rooms WHERE status = 'active'),
    (SELECT COUNT(*) FROM messages WHERE expires_at > now()),
    (SELECT COUNT(*) FROM guest_sessions WHERE last_heartbeat_at > now() - interval '30 seconds'),
    (SELECT MAX(created_at) FROM maintenance_logs);
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_health_snapshot() TO authenticated;