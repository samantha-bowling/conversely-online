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

    console.log('End chat request:', { session_id, room_id });

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
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        }
      );
    }

    if (room.status === 'ended') {
      console.log('Room already ended');
      return new Response(
        JSON.stringify({ success: true, message: 'Room already ended' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
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
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    console.log('Chat ended successfully:', room_id);

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error ending chat:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
