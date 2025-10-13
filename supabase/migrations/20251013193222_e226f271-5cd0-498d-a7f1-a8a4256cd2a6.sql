-- Drop overly restrictive policy blocking presence updates
DROP POLICY IF EXISTS "No client UPDATE on guest_sessions" ON guest_sessions;

-- Create scoped self-update policy for presence management
CREATE POLICY "Users can update own session presence"
ON guest_sessions
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Optional: Explicit service role read policy for match-opposite edge function
CREATE POLICY "Match service can read searching sessions"
ON guest_sessions
FOR SELECT
TO service_role
USING (true);