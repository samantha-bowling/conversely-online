-- Ensure full replica identity for realtime updates
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.chat_rooms REPLICA IDENTITY FULL;

-- Verify publication includes our tables
DO $$
BEGIN
  -- Drop existing publication entries if they exist
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.messages';
  EXCEPTION
    WHEN undefined_object THEN NULL;
  END;
  
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.chat_rooms';
  EXCEPTION
    WHEN undefined_object THEN NULL;
  END;
END $$;

-- Re-add tables to publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_rooms;