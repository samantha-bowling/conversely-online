import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { checkRateLimit, logRateLimit } from '../_shared/validation.ts';
import { RATE_LIMIT_CONFIG } from '../_shared/rate-limit-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const securityHeaders = {
  ...corsHeaders,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

const MAX_REQUEST_SIZE = 10 * 1024; // 10KB

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check request size
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_REQUEST_SIZE) {
      return new Response(
        JSON.stringify({ error: 'Request too large' }),
        { status: 413, headers: securityHeaders }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase configuration');
      return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        { status: 500, headers: securityHeaders }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: securityHeaders }
      );
    }

    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);

    if (authError || !user) {
      console.error('Authentication failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: securityHeaders }
      );
    }

    // Rate limiting: 10 reflections per 10 minutes per user
    const rateLimitKey = `submit-reflection:${user.id}`;
    const rateLimit = checkRateLimit(
      rateLimitKey,
      RATE_LIMIT_CONFIG.SUBMIT_REFLECTION.MAX_REQUESTS,
      RATE_LIMIT_CONFIG.SUBMIT_REFLECTION.WINDOW_MS
    );

    if (!rateLimit.allowed) {
      logRateLimit('submit-reflection', user.id, rateLimit.retryAfter ?? 0);
      return new Response(
        JSON.stringify({
          error: 'Too many reflection submissions. Please try again later.',
          retry_after: rateLimit.retryAfter,
        }),
        {
          headers: {
            ...securityHeaders,
            'Retry-After': (rateLimit.retryAfter ?? 0).toString()
          },
          status: 429
        }
      );
    }

    // Parse request body
    const body = await req.json();
    const { room_id, rating, feedback } = body;

    // Validate input
    if (!room_id || typeof room_id !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid room_id' }),
        { status: 400, headers: securityHeaders }
      );
    }

    if (rating !== null && rating !== undefined) {
      if (typeof rating !== 'number' || rating < 1 || rating > 5) {
        return new Response(
          JSON.stringify({ error: 'Rating must be between 1 and 5' }),
          { status: 400, headers: securityHeaders }
        );
      }
    }

    if (feedback && typeof feedback !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid feedback' }),
        { status: 400, headers: securityHeaders }
      );
    }

    const feedbackText = feedback?.trim().slice(0, 500) || null;

    // Get session for this user
    const { data: session, error: sessionError } = await supabase
      .from('guest_sessions')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (sessionError || !session) {
      console.error('Session lookup failed:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { status: 404, headers: securityHeaders }
      );
    }

    // Verify user was a participant in this room
    const { data: room, error: roomError } = await supabase
      .from('chat_rooms')
      .select('session_a, session_b')
      .eq('id', room_id)
      .single();

    if (roomError || !room) {
      console.error('Room lookup failed:', roomError);
      return new Response(
        JSON.stringify({ error: 'Room not found' }),
        { status: 404, headers: securityHeaders }
      );
    }

    if (room.session_a !== session.id && room.session_b !== session.id) {
      return new Response(
        JSON.stringify({ error: 'Not a participant in this room' }),
        { status: 403, headers: securityHeaders }
      );
    }

    // Check for duplicate reflection (UNIQUE constraint will catch this too)
    const { data: existingReflection } = await supabase
      .from('reflections')
      .select('id')
      .eq('room_id', room_id)
      .eq('session_id', session.id)
      .maybeSingle();

    if (existingReflection) {
      return new Response(
        JSON.stringify({ error: 'Reflection already submitted for this room' }),
        { status: 409, headers: securityHeaders }
      );
    }

    // Insert reflection
    const { error: insertError } = await supabase
      .from('reflections')
      .insert({
        room_id,
        session_id: session.id,
        rating: rating || null,
        feedback: feedbackText,
      });

    if (insertError) {
      console.error('Failed to insert reflection:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to save reflection' }),
        { status: 500, headers: securityHeaders }
      );
    }

    console.log('Reflection saved successfully:', { room_id, session_id: session.id, rating });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: securityHeaders }
    );

  } catch (error) {
    console.error('Unexpected error in submit-reflection:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: securityHeaders }
    );
  }
});
