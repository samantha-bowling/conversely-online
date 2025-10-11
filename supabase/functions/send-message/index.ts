import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import {
  validateSession,
  validateMessageContent,
  verifyRoomParticipant,
  checkRateLimit,
  logError,
  logInfo,
} from '../_shared/validation.ts';

const FUNCTION_NAME = 'send-message';
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

const MAX_REQUEST_SIZE = 2048; // 2KB limit

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
    const { room_id, content } = body;

    // Validate UUIDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!session_id || !uuidRegex.test(session_id) || !room_id || !uuidRegex.test(room_id)) {
      return new Response(
        JSON.stringify({ error: 'Invalid request parameters' }),
        { headers: securityHeaders, status: 400 }
      );
    }

    logInfo(FUNCTION_NAME, 'Send message request', { session_id, room_id, contentLength: content?.length });

    // Rate limiting: 30 messages per minute per session
    const rateLimitKey = `send-message:${session_id}`;
    const rateLimit = checkRateLimit(rateLimitKey, 30, 60000); // 30 per minute

    if (!rateLimit.allowed) {
      logInfo(FUNCTION_NAME, 'Rate limit exceeded', { session_id });
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
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

    // Validate message content
    const contentValidation = validateMessageContent(content);
    if (!contentValidation.valid) {
      logInfo(FUNCTION_NAME, 'Invalid content', { error: contentValidation.error });
      return new Response(
        JSON.stringify({ error: contentValidation.error }),
        {
          headers: securityHeaders,
          status: 400,
        }
      );
    }

    // Verify room exists and user is participant
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

    // Check room is active
    const { data: room, error: roomError } = await supabase
      .from('chat_rooms')
      .select('status')
      .eq('id', room_id)
      .single();

    if (roomError || !room) {
      logError(FUNCTION_NAME, 'Room not found', roomError);
      return new Response(
        JSON.stringify({ error: 'Room not found' }),
        {
          headers: securityHeaders,
          status: 404,
        }
      );
    }

    if (room.status !== 'active') {
      logInfo(FUNCTION_NAME, 'Room not active', { status: room.status });
      return new Response(
        JSON.stringify({ error: 'Room is not active' }),
        {
          headers: securityHeaders,
          status: 400,
        }
      );
    }

    // Insert message
    const { data: message, error: insertError } = await supabase
      .from('messages')
      .insert({
        room_id,
        session_id,
        content: content.trim(),
      })
      .select()
      .single();

    if (insertError) {
      logError(FUNCTION_NAME, 'Error inserting message', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to send message' }),
        {
          headers: securityHeaders,
          status: 500,
        }
      );
    }

    // Update room activity
    const { error: updateError } = await supabase
      .from('chat_rooms')
      .update({ last_activity: new Date().toISOString() })
      .eq('id', room_id);

    if (updateError) {
      logError(FUNCTION_NAME, 'Error updating room activity', updateError);
      // Don't fail the request if activity update fails
    }

    logInfo(FUNCTION_NAME, 'Message sent successfully', { message_id: message.id, room_id });

    return new Response(
      JSON.stringify({ success: true, message }),
      {
        headers: securityHeaders,
        status: 200,
      }
    );
  } catch (error) {
    logError(FUNCTION_NAME, 'Unexpected error sending message', error);
    return new Response(
      JSON.stringify({ error: 'Failed to send message. Please try again.' }),
      {
        headers: securityHeaders,
        status: 500,
      }
    );
  }
});
