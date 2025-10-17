import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import {
  validateSession,
  validateMessageContent,
  verifyRoomParticipant,
  checkRateLimit,
  logRateLimit,
} from '../_shared/validation.ts';
import { RATE_LIMIT_CONFIG } from '../_shared/rate-limit-config.ts';

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
      console.error('JWT validation error:', userError);
      return new Response(
        JSON.stringify({ error: 'Invalid auth token' }),
        { headers: securityHeaders, status: 401 }
      );
    }

    // Look up guest session by user_id
    const { data: session, error: sessionError } = await supabase
      .from('guest_sessions')
      .select('id, username, avatar, expires_at, is_test, reputation_score, quick_exits, last_matched_session_id, last_matched_at, next_match_at, is_searching, last_heartbeat_at, times_blocked, last_quick_exit, created_at')
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
    const { room_id, content, client_id } = body;

    // Validate UUIDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!session_id || !uuidRegex.test(session_id) || !room_id || !uuidRegex.test(room_id)) {
      return new Response(
        JSON.stringify({ error: 'Invalid request parameters' }),
        { headers: securityHeaders, status: 400 }
      );
    }

    console.log('Send message request:', { session_id, room_id, contentLength: content?.length });

    // Rate limiting: 60 messages per minute per session
    const rateLimitKey = `send-message:${session_id}`;
    const rateLimit = checkRateLimit(
      rateLimitKey,
      RATE_LIMIT_CONFIG.SEND_MESSAGE.MAX_REQUESTS,
      RATE_LIMIT_CONFIG.SEND_MESSAGE.WINDOW_MS
    );

    if (!rateLimit.allowed) {
      logRateLimit('send-message', session_id, rateLimit.retryAfter ?? 0);
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          retry_after: rateLimit.retryAfter,
        }),
        {
          headers: {
            ...securityHeaders,
            'Retry-After': (rateLimit.retryAfter ?? 0).toString()
          },
          status: 429,
        }
      );
    }

    // Validate session
    const sessionValidation = await validateSession(supabase, session_id);
    if (!sessionValidation.valid) {
      console.log('Invalid session:', sessionValidation.error);
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
      console.log('Invalid content:', contentValidation.error);
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
      console.log('Room validation failed:', roomValidation.error);
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
      console.log('Room not found:', roomError);
      return new Response(
        JSON.stringify({ error: 'Room not found' }),
        {
          headers: securityHeaders,
          status: 404,
        }
      );
    }

    if (room.status !== 'active') {
      console.log('Room not active:', room.status);
      return new Response(
        JSON.stringify({ error: 'Room is not active' }),
        {
          headers: securityHeaders,
          status: 400,
        }
      );
    }

    // Deduplication check: prevent duplicate messages within 60-second window
    // Uses (room_id, session_id, content) triple-key to identify duplicates
    if (client_id) {
      const { data: existingMessage } = await supabase
        .from('messages')
        .select('id')
        .eq('room_id', room_id)
        .eq('session_id', session_id)
        .eq('content', content.trim())
        .gte('created_at', new Date(Date.now() - 60000).toISOString())
        .limit(1)
        .single();

      if (existingMessage) {
        console.log('Deduplication: Found duplicate message:', existingMessage.id);
        return new Response(
          JSON.stringify({ 
            success: true, 
            deduplicated: true, 
            message_id: existingMessage.id 
          }),
          {
            headers: securityHeaders,
            status: 200,
          }
        );
      }
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
      console.error('Error inserting message:', insertError);
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
      console.error('Error updating room activity:', updateError);
      // Don't fail the request if activity update fails
    }

    console.log('Message sent successfully:', message.id);

    return new Response(
      JSON.stringify({ success: true, message }),
      {
        headers: securityHeaders,
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error sending message:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to send message. Please try again.' }),
      {
        headers: securityHeaders,
        status: 500,
      }
    );
  }
});
