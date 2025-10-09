-- Force Supabase Realtime to refresh table configurations
-- This ensures realtime subscriptions properly receive postgres_changes events

-- Use DO block to safely drop tables from publication
DO $$
BEGIN
    -- Drop messages from publication if it exists
    BEGIN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.messages;
    EXCEPTION
        WHEN undefined_object THEN
            NULL; -- Table was not in publication, continue
    END;
    
    -- Drop chat_rooms from publication if it exists
    BEGIN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.chat_rooms;
    EXCEPTION
        WHEN undefined_object THEN
            NULL; -- Table was not in publication, continue
    END;
END $$;

-- Re-add tables to publication with fresh configuration
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_rooms;