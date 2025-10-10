-- Drop any existing message SELECT policies
DROP POLICY IF EXISTS "rls_messages_select_final" ON public.messages;
DROP POLICY IF EXISTS "rls_messages_select_simplified" ON public.messages;
DROP POLICY IF EXISTS "rls_messages_select_minimal" ON public.messages;

-- Create security definer function to check message visibility
-- This function bypasses RLS to avoid circular dependencies
CREATE OR REPLACE FUNCTION public.can_see_room_messages(_room_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Returns TRUE if the user is a participant in the specified room
  -- Scope: Only queries chat_rooms and guest_sessions
  -- No user identifiers or message data are exposed
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_rooms cr
    JOIN public.guest_sessions gs
      ON gs.id IN (cr.session_a, cr.session_b)
    WHERE cr.id = _room_id
      AND gs.user_id = _user_id
      AND cr.status IN ('active', 'ended')
  );
$$;

-- Create new policy using security definer function
CREATE POLICY "rls_messages_select_minimal"
ON public.messages
FOR SELECT
TO authenticated, anon
USING (
  public.can_see_room_messages(messages.room_id, auth.uid())
);

-- Document the function's purpose and security model
COMMENT ON FUNCTION public.can_see_room_messages IS
'Security definer function to check if a user can see messages in a room. 
Bypasses RLS on guest_sessions and chat_rooms to avoid circular dependencies.
Scope: Only checks room membership. Returns boolean only - no data exposure.
Used exclusively by messages RLS policy.';

COMMENT ON POLICY "rls_messages_select_minimal" ON public.messages IS
'Users can only see messages from rooms where they are a participant (session_a or session_b).
Uses security definer function to avoid RLS circular dependencies.';