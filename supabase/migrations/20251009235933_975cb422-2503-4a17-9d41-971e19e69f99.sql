-- ============================================================
-- Race Condition Fix: Clean Up and Prevent Duplicate Rooms
-- ============================================================

-- Step 1: Close duplicate active rooms (keep the oldest, end the rest)
WITH duplicate_rooms AS (
  SELECT 
    id,
    LEAST(session_a, session_b) as pair_min,
    GREATEST(session_a, session_b) as pair_max,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY LEAST(session_a, session_b), GREATEST(session_a, session_b)
      ORDER BY created_at ASC
    ) as rn
  FROM public.chat_rooms
  WHERE status = 'active'
)
UPDATE public.chat_rooms
SET 
  status = 'ended',
  ended_at = now()
WHERE id IN (
  SELECT id FROM duplicate_rooms WHERE rn > 1
);

-- Step 2: Create unique index to prevent future duplicates
CREATE UNIQUE INDEX idx_chat_rooms_unique_pair 
ON public.chat_rooms (
  LEAST(session_a, session_b), 
  GREATEST(session_a, session_b)
) 
WHERE status = 'active';

COMMENT ON INDEX public.idx_chat_rooms_unique_pair IS 
  'Prevents duplicate active rooms for the same session pair using canonical ordering. '
  'Ensures (A,B) and (B,A) are treated as identical pairs.';