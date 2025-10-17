-- Add deduplication index for message retry queue
-- Optimized for (room_id, session_id, content, created_at DESC) lookups
-- Supports 60-second deduplication window checks in send-message edge function
CREATE INDEX IF NOT EXISTS idx_messages_deduplication 
ON public.messages (room_id, session_id, content, created_at DESC);

-- Add comment for documentation
COMMENT ON INDEX public.idx_messages_deduplication IS 
'Deduplication index for message retry queue: prevents duplicate messages within 60-second window.';