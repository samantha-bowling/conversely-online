-- Update message expiry to 2 minutes for conversational feel
ALTER TABLE public.messages 
ALTER COLUMN expires_at 
SET DEFAULT (now() + interval '2 minutes');