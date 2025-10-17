import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { validateActiveSession } from '../_shared/session-validation.ts';
import { verifyRoomParticipant, checkRateLimit, logRateLimit } from '../_shared/validation.ts';
import { RATE_LIMIT_CONFIG } from '../_shared/rate-limit-config.ts';
import { SESSION_EXPIRED_ERROR, UNAUTHORIZED_ERROR, REQUEST_TOO_LARGE_ERROR } from '../_shared/errors.ts';

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
        JSON.stringify(UNAUTHORIZED_ERROR),
        { headers: securityHeaders, status: 401 }
      );
    }

    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    
    if (userError || !user) {
      console.error('JWT validation error:', userError);
      return new Response(
        JSON.stringify(UNAUTHORIZED_ERROR),
        { headers: securityHeaders, status: 401 }
      );
    }

    // Validate active session with enterprise-grade checks
    const sessionValidation = await validateActiveSession(supabase, user.id);
    
    if (!sessionValidation.valid) {
      console.error('Session validation failed:', sessionValidation.error);
      return new Response(
        JSON.stringify({ 
          error: sessionValidation.error, 
          code: sessionValidation.code 
        }),
        { headers: securityHeaders, status: 401 }
      );
    }

    const mySession = sessionValidation.session!;
    const session_id = mySession.id;
    
    const body = await req.json();
    const { room_id, reason } = body;

    // Validate UUIDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!room_id || !uuidRegex.test(room_id)) {
      return new Response(
        JSON.stringify({ error: 'Invalid request parameters' }),
        { headers: securityHeaders, status: 400 }
      );
    }

    console.log('Block user request:', { session_id, room_id });

    // Rate limiting: 3 blocks per hour per session
    const rateLimitKey = `block-user:${session_id}`;
    const rateLimit = checkRateLimit(
      rateLimitKey,
      RATE_LIMIT_CONFIG.BLOCK_USER.MAX_REQUESTS,
      RATE_LIMIT_CONFIG.BLOCK_USER.WINDOW_MS
    );

    if (!rateLimit.allowed) {
      logRateLimit('block-user', session_id, rateLimit.retryAfter ?? 0);
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

    // Session validation already done above via validateActiveSession

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
          headers: securityHeaders,
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
          headers: securityHeaders,
          status: 500,
        }
      );
    }

    // Update blocked user's reputation and times_blocked counter
    // Fetch current values first
    const { data: blockedSession } = await supabase
      .from('guest_sessions')
      .select('times_blocked, reputation_score')
      .eq('id', partner_id)
      .single();

    if (blockedSession) {
      await supabase
        .from('guest_sessions')
        .update({
          times_blocked: (blockedSession.times_blocked || 0) + 1,
          reputation_score: (blockedSession.reputation_score || 0) - 3
        })
        .eq('id', partner_id);

      console.log('Updated reputation for blocked user:', partner_id);
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
        headers: securityHeaders,
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error blocking user:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to block user. Please try again.' }),
      {
        headers: securityHeaders,
        status: 500,
      }
    );
  }
});
