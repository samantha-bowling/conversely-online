-- Update can_see_session function to allow viewing partner sessions in active OR ended rooms
CREATE OR REPLACE FUNCTION public.can_see_session(_session_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    -- Case 1: User owns the session directly
    SELECT 1
    FROM public.guest_sessions gs
    WHERE gs.id = _session_id
      AND gs.user_id = _user_id
  )
  OR EXISTS (
    -- Case 2: User is in a room (active OR ended) with this session
    SELECT 1
    FROM public.chat_rooms cr
    JOIN public.guest_sessions gs_self ON gs_self.user_id = _user_id
    WHERE cr.status IN ('active', 'ended')  -- UPDATED: was just 'active'
      AND (
        (cr.session_a = _session_id AND cr.session_b = gs_self.id)
        OR
        (cr.session_b = _session_id AND cr.session_a = gs_self.id)
      )
  );
$function$;

COMMENT ON FUNCTION public.can_see_session IS
'Allows a user to view their own session or any partner session from an active or ended chat room. Used by guest_sessions RLS policy.';