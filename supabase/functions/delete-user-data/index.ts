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

const CONFIRMATION_TOKEN = 'DELETE_MY_DATA';

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
      console.error('[delete-user-data] JWT validation error:', userError);
      return new Response(
        JSON.stringify(UNAUTHORIZED_ERROR),
        { headers: securityHeaders, status: 401 }
      );
    }

    // Validate active session
    const sessionValidation = await validateActiveSession(supabase, user.id, jwt);
    
    if (!sessionValidation.valid) {
      console.error('[delete-user-data] Session validation failed:', sessionValidation.error);
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

    // Validate confirmation token
    if (!body.confirmation || body.confirmation !== CONFIRMATION_TOKEN) {
      console.error('[delete-user-data] Invalid confirmation token');
      return new Response(
        JSON.stringify({ 
          ...INVALID_INPUT_ERROR,
          details: `Confirmation must be "${CONFIRMATION_TOKEN}"`,
        }),
        { headers: securityHeaders, status: 400 }
      );
    }

    console.log(`[delete-user-data] Starting deletion for session ${session.id}`);

    // Begin deletion process (no explicit transaction, rely on FK cascades)
    const deletedCounts = {
      session: false,
      survey_answers: 0,
      reflections: 0,
      messages: 0,
      blocked_pairs: 0,
    };

    // 1. Delete survey answers
    const { error: surveyError, count: surveyCount } = await supabase
      .from('survey_answers')
      .delete({ count: 'exact' })
      .eq('session_id', session.id);

    if (surveyError) {
      console.error('[delete-user-data] Failed to delete survey answers:', surveyError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete survey answers' }),
        { headers: securityHeaders, status: 500 }
      );
    }
    deletedCounts.survey_answers = surveyCount || 0;

    // 2. Delete reflections
    const { error: reflectionsError, count: reflectionsCount } = await supabase
      .from('reflections')
      .delete({ count: 'exact' })
      .eq('session_id', session.id);

    if (reflectionsError) {
      console.error('[delete-user-data] Failed to delete reflections:', reflectionsError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete reflections' }),
        { headers: securityHeaders, status: 500 }
      );
    }
    deletedCounts.reflections = reflectionsCount || 0;

    // 3. Delete messages
    const { error: messagesError, count: messagesCount } = await supabase
      .from('messages')
      .delete({ count: 'exact' })
      .eq('session_id', session.id);

    if (messagesError) {
      console.error('[delete-user-data] Failed to delete messages:', messagesError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete messages' }),
        { headers: securityHeaders, status: 500 }
      );
    }
    deletedCounts.messages = messagesCount || 0;

    // 4. Delete blocked pairs
    const { error: blockedError, count: blockedCount } = await supabase
      .from('blocked_pairs')
      .delete({ count: 'exact' })
      .or(`session_a.eq.${session.id},session_b.eq.${session.id}`);

    if (blockedError) {
      console.error('[delete-user-data] Failed to delete blocked pairs:', blockedError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete blocked pairs' }),
        { headers: securityHeaders, status: 500 }
      );
    }
    deletedCounts.blocked_pairs = blockedCount || 0;

    // 5. Delete guest session (this will CASCADE to chat_rooms via FK)
    const { error: sessionError } = await supabase
      .from('guest_sessions')
      .delete()
      .eq('id', session.id);

    if (sessionError) {
      console.error('[delete-user-data] Failed to delete guest session:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete session' }),
        { headers: securityHeaders, status: 500 }
      );
    }
    deletedCounts.session = true;

    // 6. Revoke JWT by deleting auth.sessions
    const { error: authError } = await supabase.auth.admin.signOut(user.id);

    if (authError) {
      console.error('[delete-user-data] Failed to revoke JWT:', authError);
      // Non-fatal - session data is already deleted
    }

    const jwtRevoked = !authError;

    // 7. Log deletion to maintenance_logs for audit trail
    await supabase
      .from('maintenance_logs')
      .insert({
        job_name: 'gdpr_deletion',
        closed_count: 1,
        would_close_count: 1,
        safety_clamp_triggered: false,
      });

    console.log(`[delete-user-data] ✓ Deletion complete for session ${session.id}`);
    console.log(`[delete-user-data] Deleted: ${deletedCounts.survey_answers} survey answers, ${deletedCounts.reflections} reflections, ${deletedCounts.messages} messages, ${deletedCounts.blocked_pairs} blocked pairs`);

    return new Response(
      JSON.stringify({
        success: true,
        deleted: deletedCounts,
        jwt_revoked: jwtRevoked,
        deleted_at: new Date().toISOString(),
      }),
      { headers: securityHeaders, status: 200 }
    );

  } catch (error) {
    console.error('[delete-user-data] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to delete user data' }),
      { headers: securityHeaders, status: 500 }
    );
  }
});
