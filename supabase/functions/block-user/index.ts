import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { validateSession, verifyRoomParticipant, checkRateLimit } from '../_shared/validation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { session_id, room_id } = await req.json();

    console.log('Block user request:', { session_id, room_id });

    // Rate limiting: 3 blocks per hour per session
    const rateLimitKey = `block-user:${session_id}`;
    const rateLimit = checkRateLimit(rateLimitKey, 3, 3600000); // 3 per hour

    if (!rateLimit.allowed) {
      console.log('Rate limit exceeded for session:', session_id);
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          retry_after: rateLimit.retryAfter,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        }
      );
    }

    // Get room data to find partner
    const { data: room, error: roomError } = await supabase
      .from('chat_rooms')
      .select('session_a, session_b, status')
      .eq('id', room_id)
      .single();

    if (roomError || !room) {
      console.log('Room not found:', roomError);
      return new Response(
        JSON.stringify({ error: 'Room not found' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        }
      );
    }

    const partner_id = room.session_a === session_id ? room.session_b : room.session_a;

    // Insert blocked pair (bidirectional)
    const { error: blockError } = await supabase
      .from('blocked_pairs')
      .insert({
        session_a: session_id,
        session_b: partner_id,
      });

    if (blockError) {
      console.error('Error inserting blocked pair:', blockError);
      return new Response(
        JSON.stringify({ error: 'Failed to block user' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    // End the chat if not already ended
    if (room.status !== 'ended') {
      const { error: endError } = await supabase
        .from('chat_rooms')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString(),
        })
        .eq('id', room_id);

      if (endError) {
        console.error('Error ending chat:', endError);
        // Don't fail the request if ending fails, block was successful
      }
    }

    console.log('User blocked successfully:', { blocker: session_id, blocked: partner_id });

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error blocking user:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
