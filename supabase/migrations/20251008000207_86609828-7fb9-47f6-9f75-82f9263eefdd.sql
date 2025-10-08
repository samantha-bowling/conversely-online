-- Remove policy allowing users to see partner survey answers in active rooms
-- This enhances privacy by ensuring users can only see their own survey answers
-- The matching algorithm still works as it uses the service role key

DROP POLICY IF EXISTS "Users can see partner answers in active rooms" ON public.survey_answers;