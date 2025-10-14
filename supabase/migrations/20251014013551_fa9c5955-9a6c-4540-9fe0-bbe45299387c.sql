-- Production Readiness Security Hardening
-- Phase 1: Restrict chat_rooms INSERT policy to prevent client-side room creation

-- Drop permissive INSERT policy that allows clients to create rooms directly
DROP POLICY IF EXISTS "rls_chat_rooms_insert_own_sessions" ON chat_rooms;

-- Add restrictive INSERT policy - only edge functions can create rooms via service role key
CREATE POLICY "No client INSERT on chat_rooms" 
ON chat_rooms
FOR INSERT 
TO authenticated, anon 
WITH CHECK (false);

COMMENT ON POLICY "No client INSERT on chat_rooms" ON chat_rooms IS 
'Clients cannot create rooms directly. Only the atomic_create_match_room() function can create rooms via service role key.';