import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import {
  validateRating,
  validateFeedback,
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

const MAX_REQUEST_SIZE = 2048; // 2KB limit for feedback

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
    const { session_id, room_id, rating, feedback } = body;

    // Validate UUIDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!session_id || !uuidRegex.test(session_id) || !room_id || !uuidRegex.test(room_id)) {
      return new Response(
        JSON.stringify({ error: 'Invalid request parameters' }),
        { headers: securityHeaders, status: 400 }
      );
    }

    console.log('Submit reflection request:', { session_id, room_id, rating: rating || 'none', hasFeedback: !!feedback });

    // Rate limiting: 5 reflections per hour per session
    const rateLimitKey = `submit-reflection:${session_id}`;
    const rateLimit = checkRateLimit(rateLimitKey, 5, 3600000); // 5 per hour

    if (!rateLimit.allowed) {
      console.log('Rate limit exceeded - reflection already submitted');
      return new Response(
        JSON.stringify({
          error: 'Reflection already submitted for this conversation',
        }),
        {
          headers: securityHeaders,
          status: 429,
        }
      );
    }

    // Validate session exists (allow expired sessions for reflections)
    if (!session_id || typeof session_id !== 'string') {
      console.log('Invalid session ID');
      return new Response(
        JSON.stringify({ error: 'Invalid session ID' }),
        {
          headers: securityHeaders,
          status: 400,
        }
      );
    }

    const { data: session, error: sessionError } = await supabase
      .from('guest_sessions')
      .select('id')
      .eq('id', session_id)
      .single();

    if (sessionError || !session) {
      console.log('Session not found');
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        {
          headers: securityHeaders,
          status: 404,
        }
      );
    }

    // Validate room exists and user was participant
    const { data: room, error: roomError } = await supabase
      .from('chat_rooms')
      .select('id, session_a, session_b, status')
      .eq('id', room_id)
      .single();

    if (roomError || !room) {
      console.log('Room not found');
      return new Response(
        JSON.stringify({ error: 'Room not found' }),
        {
          headers: securityHeaders,
          status: 404,
        }
      );
    }

    // Verify user was participant
    const isParticipant = room.session_a === session_id || room.session_b === session_id;
    if (!isParticipant) {
      console.log('User was not participant in room');
      return new Response(
        JSON.stringify({ error: 'Not authorized for this room' }),
        {
          headers: securityHeaders,
          status: 403,
        }
      );
    }

    // Validate rating
    const ratingValidation = validateRating(rating);
    if (!ratingValidation.valid) {
      console.log('Invalid rating:', ratingValidation.error);
      return new Response(
        JSON.stringify({ error: ratingValidation.error }),
        {
          headers: securityHeaders,
          status: 400,
        }
      );
    }

    // Validate feedback
    const feedbackValidation = validateFeedback(feedback);
    if (!feedbackValidation.valid) {
      console.log('Invalid feedback:', feedbackValidation.error);
      return new Response(
        JSON.stringify({ error: feedbackValidation.error }),
        {
          headers: securityHeaders,
          status: 400,
        }
      );
    }

    // Insert reflection (only if rating provided)
    if (rating) {
      const { error: insertError } = await supabase
        .from('reflections')
        .insert({
          room_id,
          session_id,
          rating,
          feedback: feedback?.trim() || null,
        });

      if (insertError) {
        console.error('Error inserting reflection:', insertError);
        return new Response(
          JSON.stringify({ error: 'Failed to submit reflection' }),
          {
            headers: securityHeaders,
            status: 500,
          }
        );
      }

      console.log('Reflection submitted successfully:', { room_id, rating });
    } else {
      console.log('No rating provided - skipping reflection');
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: securityHeaders,
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error submitting reflection:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to submit reflection. Please try again.' }),
      {
        headers: securityHeaders,
        status: 500,
      }
    );
  }
});
