import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { validateSession, verifyRoomParticipant } from '../_shared/validation.ts';

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

    console.log('Get room data request:', { session_id, room_id });

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

    // Fetch room data
    const { data: room, error } = await supabase
      .from('chat_rooms')
      .select('id, status, last_activity, session_a, session_b, ended_at')
      .eq('id', room_id)
      .single();

    if (error || !room) {
      console.log('Room not found:', error);
      return new Response(
        JSON.stringify({ error: 'Room not found' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        }
      );
    }

    // Determine partner session ID
    const partner_id = room.session_a === session_id ? room.session_b : room.session_a;

    console.log('Room data retrieved:', { room_id, status: room.status });

    return new Response(
      JSON.stringify({
        room_id: room.id,
        status: room.status,
        last_activity: room.last_activity,
        partner_id,
        ended_at: room.ended_at,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error getting room data:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
