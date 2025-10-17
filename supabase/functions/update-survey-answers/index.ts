import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { validateActiveSession } from '../_shared/session-validation.ts';
import { UNAUTHORIZED_ERROR, INVALID_INPUT_ERROR } from '../_shared/errors.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const securityHeaders = {
  ...corsHeaders,
  'Content-Type': 'application/json',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

interface SurveyAnswer {
  question_id: string;
  answer: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Extract and validate JWT from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify(UNAUTHORIZED_ERROR),
        { headers: securityHeaders, status: 401 }
      );
    }

    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    
    if (userError || !user) {
      console.error('[update-survey-answers] JWT validation error:', userError);
      return new Response(
        JSON.stringify(UNAUTHORIZED_ERROR),
        { headers: securityHeaders, status: 401 }
      );
    }

    // Validate active session
    const sessionValidation = await validateActiveSession(supabase, user.id, jwt);
    
    if (!sessionValidation.valid) {
      console.error('[update-survey-answers] Session validation failed:', sessionValidation.error);
      return new Response(
        JSON.stringify({ 
          error: sessionValidation.error, 
          code: sessionValidation.code 
        }),
        { headers: securityHeaders, status: 401 }
      );
    }

    const session = sessionValidation.session!;
    const body = await req.json();

    // Validate request body
    if (!body.answers || !Array.isArray(body.answers) || body.answers.length === 0) {
      return new Response(
        JSON.stringify({ 
          ...INVALID_INPUT_ERROR,
          details: 'Must provide an array of answers',
        }),
        { headers: securityHeaders, status: 400 }
      );
    }

    const answers: SurveyAnswer[] = body.answers;

    // Validate each answer
    for (const answer of answers) {
      if (!answer.question_id || typeof answer.question_id !== 'string') {
        return new Response(
          JSON.stringify({ 
            ...INVALID_INPUT_ERROR,
            details: 'Each answer must have a valid question_id',
          }),
          { headers: securityHeaders, status: 400 }
        );
      }

      if (!answer.answer || typeof answer.answer !== 'string' || answer.answer.trim().length === 0) {
        return new Response(
          JSON.stringify({ 
            ...INVALID_INPUT_ERROR,
            details: 'Each answer must have a non-empty answer string',
          }),
          { headers: securityHeaders, status: 400 }
        );
      }

      if (answer.answer.length > 500) {
        return new Response(
          JSON.stringify({ 
            ...INVALID_INPUT_ERROR,
            details: 'Answer must be less than 500 characters',
          }),
          { headers: securityHeaders, status: 400 }
        );
      }
    }

    console.log(`[update-survey-answers] Updating ${answers.length} answers for session ${session.id}`);

    let updatedCount = 0;

    // Update each answer
    for (const answer of answers) {
      const { error } = await supabase
        .from('survey_answers')
        .update({ 
          answer: answer.answer.trim(),
        })
        .eq('session_id', session.id)
        .eq('question_id', answer.question_id);

      if (error) {
        console.error('[update-survey-answers] Failed to update answer:', error);
        return new Response(
          JSON.stringify({ 
            error: 'Failed to update survey answer',
            details: error.message,
          }),
          { headers: securityHeaders, status: 500 }
        );
      }

      updatedCount++;
    }

    console.log(`[update-survey-answers] ✓ Updated ${updatedCount} answers for session ${session.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        updated_count: updatedCount,
        updated_at: new Date().toISOString(),
      }),
      { headers: securityHeaders, status: 200 }
    );

  } catch (error) {
    console.error('[update-survey-answers] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to update survey answers' }),
      { headers: securityHeaders, status: 500 }
    );
  }
});
