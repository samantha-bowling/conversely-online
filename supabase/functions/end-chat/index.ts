import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { validateSession, verifyRoomParticipant, checkRateLimit } from '../_shared/validation.ts';

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
      console.error('JWT validation error:', userError);
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
    const { room_id, quick_exit, rating, feedback } = body;

    // Validate UUIDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!room_id || !uuidRegex.test(room_id)) {
      return new Response(
        JSON.stringify({ error: 'Invalid request parameters' }),
        { headers: securityHeaders, status: 400 }
      );
    }

    console.log('End chat request:', { session_id, room_id });

    // Rate limiting: 10 end-chat calls per 10 minutes per session
    const rateLimitKey = `end-chat:${session_id}`;
    const rateLimit = checkRateLimit(rateLimitKey, 10, 600000); // 10 per 10 min

    if (!rateLimit.allowed) {
      console.log('Rate limit exceeded for session:', session_id);
      return new Response(
        JSON.stringify({
          error: 'Too many end chat attempts',
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

    // Verify room participant
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

    // Check room is active and get creation time
    const { data: room, error: roomError } = await supabase
      .from('chat_rooms')
      .select('status, created_at, session_a, session_b')
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

    if (room.status === 'ended') {
      console.log('Room already ended');
      return new Response(
        JSON.stringify({ success: true, message: 'Room already ended' }),
        {
          headers: securityHeaders,
          status: 200,
        }
      );
    }

    // Track quick exits (rooms ended within 30 seconds)
    const roomDuration = Date.now() - new Date(room.created_at).getTime();
    const isQuickExit = roomDuration < 30000; // 30 seconds

    if (isQuickExit) {
      console.log('Quick exit detected:', { session_id, room_id, duration: roomDuration });
      
      // Fetch current values
      const { data: userSession } = await supabase
        .from('guest_sessions')
        .select('quick_exits, reputation_score')
        .eq('id', session_id)
        .single();

      if (userSession) {
        const newQuickExits = (userSession.quick_exits || 0) + 1;
        
        // Update quick_exits counter and apply reputation penalty
        await supabase
          .from('guest_sessions')
          .update({
            quick_exits: newQuickExits,
            last_quick_exit: new Date().toISOString(),
            reputation_score: (userSession.reputation_score || 0) - 1
          })
          .eq('id', session_id);

        // Check if user has too many quick exits (5+)
        if (newQuickExits >= 5) {
          // Apply 30-minute cooldown for serial room hoppers
          const cooldownEnd = new Date(Date.now() + 1800000); // 30 minutes
          await supabase
            .from('guest_sessions')
            .update({ next_match_at: cooldownEnd.toISOString() })
            .eq('id', session_id);
          
          console.log('Applied cooldown for quick exit pattern:', session_id);
        }
      }
    } else {
      // Reward completed chats with +1 reputation
      const { data: userSession } = await supabase
        .from('guest_sessions')
        .select('reputation_score')
        .eq('id', session_id)
        .single();

      if (userSession) {
        await supabase
          .from('guest_sessions')
          .update({
            reputation_score: (userSession.reputation_score || 0) + 1
          })
          .eq('id', session_id);
      }
    }

    // End the chat
    const { error: updateError } = await supabase
      .from('chat_rooms')
      .update({
        status: 'ended',
        ended_at: new Date().toISOString(),
      })
      .eq('id', room_id);

    if (updateError) {
      console.error('Error ending chat:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to end chat' }),
        {
          headers: securityHeaders,
          status: 500,
        }
      );
    }

    console.log('Chat ended successfully:', room_id);

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: securityHeaders,
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error ending chat:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to end chat. Please try again.' }),
      {
        headers: securityHeaders,
        status: 500,
      }
    );
  }
});
