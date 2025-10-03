import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import {
  validateSession,
  validateMessageContent,
  verifyRoomParticipant,
  checkRateLimit,
} from '../_shared/validation.ts';

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

    const body = await req.json();
    const { session_id, room_id, content } = body;

    // Validate UUIDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!session_id || !uuidRegex.test(session_id) || !room_id || !uuidRegex.test(room_id)) {
      return new Response(
        JSON.stringify({ error: 'Invalid request parameters' }),
        { headers: securityHeaders, status: 400 }
      );
    }

    console.log('Send message request:', { session_id, room_id, contentLength: content?.length });

    // Rate limiting: 10 messages per minute per session
    const rateLimitKey = `send-message:${session_id}`;
    const rateLimit = checkRateLimit(rateLimitKey, 10, 60000); // 10 per minute

    if (!rateLimit.allowed) {
      console.log('Rate limit exceeded for session:', session_id);
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
