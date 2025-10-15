-- Enable required extensions for automated cleanup
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule cleanup job for expired messages (every 2 minutes)
SELECT cron.schedule(
  'cleanup-expired-messages',
  '*/2 * * * *',
  $$SELECT cleanup_expired_messages()$$
);

-- Schedule cleanup job for expired sessions (every hour)
SELECT cron.schedule(
  'cleanup-expired-sessions',
  '0 * * * *',
  $$SELECT cleanup_expired_sessions()$$
);

-- Schedule cleanup job for inactive rooms (every 5 minutes)
SELECT cron.schedule(
  'close-inactive-rooms',
  '*/5 * * * *',
  $$SELECT close_inactive_rooms()$$
);

-- Schedule cleanup job for old maintenance logs (monthly on 1st day)
SELECT cron.schedule(
  'cleanup-old-maintenance-logs',
  '0 0 1 * *',
  $$SELECT cleanup_old_maintenance_logs()$$
);