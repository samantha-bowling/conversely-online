import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { validateMessageContent, sanitizeText, logError, logInfo } from '../_shared/validation.ts';
import { ALL_QUESTION_IDS, isValidQuestionId } from '../_shared/survey-questions.ts';

const FUNCTION_NAME = 'submit-survey-answers';
const SITE_URL = Deno.env.get('SITE_URL') || 'https://conversely.app';
const IS_DEV = Deno.env.get('ENVIRONMENT') === 'development';

const corsHeaders = {
  'Access-Control-Allow-Origin': IS_DEV ? '*' : SITE_URL,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const securityHeaders = {
  ...corsHeaders,
  'Content-Type': 'application/json',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': "default-src 'none'; script-src 'none'; connect-src 'self'; img-src 'none'; style-src 'none'",
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=()',
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
      logError(FUNCTION_NAME, 'Missing authorization header', new Error('No auth header'));
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: securityHeaders }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      logError(FUNCTION_NAME, 'Auth error', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: securityHeaders }
      );
    }

    // 2. Parse and validate request body
    const { session_id, answers } = await req.json();

    if (!session_id || !answers || !Array.isArray(answers)) {
      return new Response(
        JSON.stringify({ error: 'Invalid request body' }),
        { status: 400, headers: securityHeaders }
      );
    }

    logInfo(FUNCTION_NAME, 'Processing survey submission', { session_id, user_id: user.id, answerCount: answers.length });

    // 3. Verify session ownership
    const { data: session, error: sessionError } = await supabase
      .from('guest_sessions')
      .select('id, user_id')
      .eq('id', session_id)
      .eq('user_id', user.id)
      .single();

    if (sessionError || !session) {
      logError(FUNCTION_NAME, 'Session verification failed', sessionError);
      return new Response(
        JSON.stringify({ error: 'Invalid session or unauthorized access' }),
        { status: 403, headers: securityHeaders }
      );
    }

    // 4. Check for duplicate submissions (prevent re-submission)
    const { data: existingAnswers, error: checkError } = await supabase
      .from('survey_answers')
      .select('id')
      .eq('session_id', session_id)
      .limit(1);

    if (checkError) {
      logError(FUNCTION_NAME, 'Error checking existing answers', checkError);
      return new Response(
        JSON.stringify({ error: 'Database error' }),
        { status: 500, headers: securityHeaders }
      );
    }

    if (existingAnswers && existingAnswers.length > 0) {
      logInfo(FUNCTION_NAME, 'Duplicate submission attempt', { session_id });
      return new Response(
        JSON.stringify({ error: 'Survey already submitted for this session' }),
        { status: 409, headers: securityHeaders }
      );
    }

    // 5. Validate each answer
    const validatedAnswers = [];
    for (const answer of answers) {
      const { question_id, answer: answerText } = answer;

      // Validate question_id using type-safe helper
      if (!isValidQuestionId(question_id)) {
        logError(FUNCTION_NAME, 'Invalid question_id', new Error(`Invalid: ${question_id}`));
        return new Response(
          JSON.stringify({ error: `Invalid question_id: ${question_id}` }),
          { status: 400, headers: securityHeaders }
        );
      }

      // Sanitize and validate answer text
      const sanitized = sanitizeText(answerText);
      
      // Check length (answers should be short, predefined options)
      if (sanitized.length > 100) {
        logError(FUNCTION_NAME, 'Answer too long', new Error(`Question: ${question_id}`));
        return new Response(
          JSON.stringify({ error: 'Answer text too long' }),
          { status: 400, headers: securityHeaders }
        );
      }

      // Validate content using shared validation
      const validation = validateMessageContent(sanitized);
      if (!validation.valid) {
        logInfo(FUNCTION_NAME, 'Blocked content in answer', { error: validation.error });
        return new Response(
          JSON.stringify({ error: `Invalid answer content: ${validation.error}` }),
          { status: 400, headers: securityHeaders }
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
        { status: 400, headers: securityHeaders }
      );
    }

    // 7. Insert all validated answers
    const { error: insertError } = await supabase
      .from('survey_answers')
      .insert(validatedAnswers);

    if (insertError) {
      logError(FUNCTION_NAME, 'Error inserting survey answers', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to save survey answers' }),
        { status: 500, headers: securityHeaders }
      );
    }

    logInfo(FUNCTION_NAME, 'Successfully submitted answers', { session_id, count: validatedAnswers.length });

    return new Response(
      JSON.stringify({ success: true, count: validatedAnswers.length }),
      { headers: securityHeaders }
    );

  } catch (error) {
    logError(FUNCTION_NAME, 'Unexpected error', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: securityHeaders }
    );
  }
});
