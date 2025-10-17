import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { validateActiveSession } from '../_shared/session-validation.ts';
import { UNAUTHORIZED_ERROR } from '../_shared/errors.ts';

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
      console.error('[export-user-data] JWT validation error:', userError);
      return new Response(
        JSON.stringify(UNAUTHORIZED_ERROR),
        { headers: securityHeaders, status: 401 }
      );
    }

    // Validate active session
    const sessionValidation = await validateActiveSession(supabase, user.id, jwt);
    
    if (!sessionValidation.valid) {
      console.error('[export-user-data] Session validation failed:', sessionValidation.error);
      return new Response(
        JSON.stringify({ 
          error: sessionValidation.error, 
          code: sessionValidation.code 
        }),
        { headers: securityHeaders, status: 401 }
      );
    }

    const session = sessionValidation.session!;
    console.log(`[export-user-data] Exporting data for session ${session.id}`);

    // Query session data
    const { data: sessionData, error: sessionError } = await supabase
      .from('guest_sessions')
      .select('id, username, avatar, created_at, expires_at')
      .eq('id', session.id)
      .single();

    if (sessionError) {
      console.error('[export-user-data] Failed to fetch session:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Failed to export session data' }),
        { headers: securityHeaders, status: 500 }
      );
    }

    // Query survey answers
    const { data: surveyAnswers, error: surveyError } = await supabase
      .from('survey_answers')
      .select('question_id, answer, created_at')
      .eq('session_id', session.id)
      .order('created_at', { ascending: true });

    if (surveyError) {
      console.error('[export-user-data] Failed to fetch survey answers:', surveyError);
    }

    // Query chat rooms with message counts
    const { data: chatRooms, error: roomsError } = await supabase
      .from('chat_rooms')
      .select('id, status, created_at, ended_at')
      .or(`session_a.eq.${session.id},session_b.eq.${session.id}`)
      .order('created_at', { ascending: true });

    if (roomsError) {
      console.error('[export-user-data] Failed to fetch chat rooms:', roomsError);
    }

    // Count messages for each room
    const roomsWithMessageCounts = await Promise.all(
      (chatRooms || []).map(async (room) => {
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('room_id', room.id);

        return {
          id: room.id,
          status: room.status,
          created_at: room.created_at,
          ended_at: room.ended_at,
          message_count: count || 0,
        };
      })
    );

    // Query reflections
    const { data: reflections, error: reflectionsError } = await supabase
      .from('reflections')
      .select('room_id, rating, feedback, created_at')
      .eq('session_id', session.id)
      .order('created_at', { ascending: true });

    if (reflectionsError) {
      console.error('[export-user-data] Failed to fetch reflections:', reflectionsError);
    }

    // Build export response
    const exportData = {
      session: {
        id: sessionData.id,
        username: sessionData.username,
        avatar: sessionData.avatar,
        created_at: sessionData.created_at,
        expires_at: sessionData.expires_at,
      },
      survey_answers: surveyAnswers || [],
      chat_rooms: roomsWithMessageCounts,
      reflections: reflections || [],
      exported_at: new Date().toISOString(),
    };

    console.log(`[export-user-data] ✓ Export complete for session ${session.id}`);
    console.log(`[export-user-data] Stats: ${surveyAnswers?.length || 0} survey answers, ${chatRooms?.length || 0} chat rooms, ${reflections?.length || 0} reflections`);

    // Log export to maintenance_logs for audit trail
    await supabase
      .from('maintenance_logs')
      .insert({
        job_name: 'gdpr_export',
        closed_count: 1,
        would_close_count: 1,
        safety_clamp_triggered: false,
      });

    return new Response(
      JSON.stringify(exportData),
      { headers: securityHeaders, status: 200 }
    );

  } catch (error) {
    console.error('[export-user-data] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to export user data' }),
      { headers: securityHeaders, status: 500 }
    );
  }
});
