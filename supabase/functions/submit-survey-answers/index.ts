import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { validateMessageContent, sanitizeText } from '../_shared/validation.ts';
import { ALL_QUESTION_IDS, isValidQuestionId } from '../_shared/survey-questions.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Validate JWT and get user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Parse and validate request body
    const { session_id, answers } = await req.json();

    if (!session_id || !answers || !Array.isArray(answers)) {
      return new Response(
        JSON.stringify({ error: 'Invalid request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing survey submission for session ${session_id}, user ${user.id}`);

    // 3. Verify session ownership
    const { data: session, error: sessionError } = await supabase
      .from('guest_sessions')
      .select('id, user_id')
      .eq('id', session_id)
      .eq('user_id', user.id)
      .single();

    if (sessionError || !session) {
      console.error('Session verification failed:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Invalid session or unauthorized access' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Check for duplicate submissions (prevent re-submission)
    const { data: existingAnswers, error: checkError } = await supabase
      .from('survey_answers')
      .select('id')
      .eq('session_id', session_id)
      .limit(1);

    if (checkError) {
      console.error('Error checking existing answers:', checkError);
      return new Response(
        JSON.stringify({ error: 'Database error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (existingAnswers && existingAnswers.length > 0) {
      console.warn(`Duplicate submission attempt for session ${session_id}`);
      return new Response(
        JSON.stringify({ error: 'Survey already submitted for this session' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Validate each answer
    const validatedAnswers = [];
    for (const answer of answers) {
      const { question_id, answer: answerText } = answer;

      // Validate question_id using type-safe helper
      if (!isValidQuestionId(question_id)) {
        console.error(`Invalid question_id: ${question_id}`);
        return new Response(
          JSON.stringify({ error: `Invalid question_id: ${question_id}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Sanitize and validate answer text
      const sanitized = sanitizeText(answerText);
      
      // Check length (answers should be short, predefined options)
      if (sanitized.length > 100) {
        console.error(`Answer too long for question ${question_id}`);
        return new Response(
          JSON.stringify({ error: 'Answer text too long' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate content using shared validation
      const validation = validateMessageContent(sanitized);
      if (!validation.valid) {
        console.error(`Blocked content in answer: ${validation.error}`);
        return new Response(
          JSON.stringify({ error: `Invalid answer content: ${validation.error}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      validatedAnswers.push({
        session_id,
        question_id,
        answer: sanitized,
      });
    }

    // 6. Require minimum number of answers
    if (validatedAnswers.length < 5) {
      return new Response(
        JSON.stringify({ error: 'At least 5 answers required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 7. Insert all validated answers
    const { error: insertError } = await supabase
      .from('survey_answers')
      .insert(validatedAnswers);

    if (insertError) {
      console.error('Error inserting survey answers:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to save survey answers' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Successfully submitted ${validatedAnswers.length} answers for session ${session_id}`);

    return new Response(
      JSON.stringify({ success: true, count: validatedAnswers.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in submit-survey-answers:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
