-- Step 1: Create security definer function (bypasses RLS)
CREATE OR REPLACE FUNCTION public.can_see_room(_room_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Returns TRUE if the user is a participant in the specified room
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_rooms cr
    JOIN public.guest_sessions gs
      ON gs.id IN (cr.session_a, cr.session_b)
    WHERE cr.id = _room_id
      AND gs.user_id = _user_id
  );
$$;

-- Step 2: Drop old policy with circular subquery
DROP POLICY IF EXISTS "Users can only see their own rooms" ON public.chat_rooms;

-- Step 3: Create new policy using security definer function
CREATE POLICY "Users can see own rooms"
ON public.chat_rooms
FOR SELECT
TO authenticated
USING (can_see_room(id, auth.uid()));