-- Update message expiry from 60 seconds to 2 minutes
-- Aligns with published Privacy Policy and provides better user experience
ALTER TABLE public.messages 
ALTER COLUMN expires_at SET DEFAULT (now() + interval '2 minutes');