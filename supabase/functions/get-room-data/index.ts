import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { validateSession, verifyRoomParticipant, checkRateLimit, logError, logInfo } from '../_shared/validation.ts';

const FUNCTION_NAME = 'get-room-data';
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

const MAX_REQUEST_SIZE = 1024; // 1KB limit

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check request size
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_REQUEST_SIZE) {
      return new Response(
        JSON.stringify({ error: 'Request too large' }),
        { headers: securityHeaders, status: 413 }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Extract and validate JWT from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - missing auth token' }),
        { headers: securityHeaders, status: 401 }
      );
    }

    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    
    if (userError || !user) {
      logError(FUNCTION_NAME, 'JWT validation failed', userError);
      return new Response(
        JSON.stringify({ error: 'Invalid auth token' }),
        { headers: securityHeaders, status: 401 }
      );
    }

    // Look up guest session by user_id
    const { data: session, error: sessionError } = await supabase
      .from('guest_sessions')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { headers: securityHeaders, status: 404 }
      );
    }

    const session_id = session.id;
    
    const body = await req.json();
    const { room_id } = body;

    // Validate UUIDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!session_id || !uuidRegex.test(session_id) || !room_id || !uuidRegex.test(room_id)) {
      return new Response(
        JSON.stringify({ error: 'Invalid request parameters' }),
        { headers: securityHeaders, status: 400 }
      );
    }

    logInfo(FUNCTION_NAME, 'Get room data request', { session_id, room_id });

    // Rate limiting: 60 requests per minute per session
    const rateLimitKey = `get-room-data:${session_id}`;
    const rateLimit = checkRateLimit(rateLimitKey, 60, 60000); // 60 per minute

    if (!rateLimit.allowed) {
      logInfo(FUNCTION_NAME, 'Rate limit exceeded', { session_id });
      return new Response(
        JSON.stringify({
          error: 'Too many room data requests',
          retry_after: rateLimit.retryAfter,
        }),
        {
          headers: securityHeaders,
          status: 429,
        }
      );
    }

    // Validate session
    const sessionValidation = await validateSession(supabase, session_id);
    if (!sessionValidation.valid) {
      logInfo(FUNCTION_NAME, 'Invalid session', { error: sessionValidation.error });
      return new Response(
        JSON.stringify({ error: sessionValidation.error }),
        {
          headers: securityHeaders,
          status: 401,
        }
      );
    }

    // Verify room participant
    const roomValidation = await verifyRoomParticipant(supabase, room_id, session_id);
    if (!roomValidation.valid) {
      logInfo(FUNCTION_NAME, 'Room validation failed', { error: roomValidation.error });
      return new Response(
        JSON.stringify({ error: roomValidation.error }),
        {
          headers: securityHeaders,
          status: 403,
        }
      );
    }

    // Fetch room data
    const { data: room, error } = await supabase
      .from('chat_rooms')
      .select('id, status, last_activity, session_a, session_b, ended_at')
      .eq('id', room_id)
      .single();

    if (error || !room) {
      logError(FUNCTION_NAME, 'Room not found', error);
      return new Response(
        JSON.stringify({ error: 'Room not found' }),
        {
          headers: securityHeaders,
          status: 404,
        }
      );
    }

    // Determine partner session ID
    const partner_id = room.session_a === session_id ? room.session_b : room.session_a;

    // Fetch partner's username and avatar
    const { data: partnerSession } = await supabase
      .from('guest_sessions')
      .select('username, avatar')
      .eq('id', partner_id)
      .single();

    logInfo(FUNCTION_NAME, 'Room data retrieved', { room_id, status: room.status });

    return new Response(
      JSON.stringify({
        room_id: room.id,
        status: room.status,
        last_activity: room.last_activity,
        partner_id,
        partner_username: partnerSession?.username || 'Anonymous',
        partner_avatar: partnerSession?.avatar || '👤',
        ended_at: room.ended_at,
      }),
      {
        headers: securityHeaders,
        status: 200,
      }
    );
  } catch (error) {
    logError(FUNCTION_NAME, 'Unexpected error getting room data', error);
    return new Response(
      JSON.stringify({ error: 'Failed to retrieve room data. Please try again.' }),
      {
        headers: securityHeaders,
        status: 500,
      }
    );
  }
});
