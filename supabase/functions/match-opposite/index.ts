import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { checkRateLimit } from '../_shared/validation.ts';

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

const MAX_REQUEST_SIZE = 1024; // 1KB limit for request body

const BLOCKED_PATTERNS = [
  /\b(fuck|shit|ass|bitch|damn)\b/i,
  /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/,
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
];

function containsBlockedContent(text: string): boolean {
  return BLOCKED_PATTERNS.some(pattern => pattern.test(text));
}

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
    const { data: sessionData, error: sessionError } = await supabase
      .from('guest_sessions')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (sessionError || !sessionData) {
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { headers: securityHeaders, status: 404 }
      );
    }

    const session_id = sessionData.id;

    // Rate limiting: 20 match attempts per 5 minutes per session
    const rateLimitKey = `match-opposite:${session_id}`;
    const rateLimit = checkRateLimit(rateLimitKey, 20, 300000); // 20 per 5 min

    if (!rateLimit.allowed) {
      console.log('Rate limit exceeded for session:', session_id);
      return new Response(
        JSON.stringify({
          status: 'rate_limited',
          error: 'Too many match requests. Please try again later.',
          retry_after: rateLimit.retryAfter,
        }),
        {
          headers: securityHeaders,
          status: 429,
        }
      );
    }

    // Check for emergency kill switch
    const matchingDisabled = Deno.env.get('MATCHING_DISABLED');
    if (matchingDisabled === 'true') {
      return new Response(
        JSON.stringify({ 
          status: 'maintenance',
          error: 'Matching is temporarily disabled for maintenance. Please try again later.'
        }),
        {
          headers: securityHeaders,
          status: 503,
        }
      );
    }

    // Check user session and behavioral flags
    const session = sessionData;

    if (!session) {
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { headers: securityHeaders, status: 404 }
      );
    }

    // Filter out serial trolls (5+ blocks from different users)
    if (session.times_blocked >= 5) {
      console.log('Serial troll detected, blocking match:', session_id);
      return new Response(
        JSON.stringify({ 
          status: 'restricted',
          error: 'Your account has been restricted due to multiple reports. Please contact support.'
        }),
        {
          headers: securityHeaders,
          status: 403,
        }
      );
    }

    // Apply reputation-based cooldown multipliers
    let baseCooldown = session.is_test ? 10000 : 90000; // 10s for test, 90s for production
    if (session.reputation_score < -20) {
      baseCooldown = 300000; // 5 minutes for very low reputation
    } else if (session.reputation_score < -10) {
      baseCooldown = 180000; // 3 minutes for low reputation
    }

    if (session.next_match_at && new Date(session.next_match_at) > new Date()) {
      const waitSeconds = Math.ceil(
        (new Date(session.next_match_at).getTime() - Date.now()) / 1000
      );
      return new Response(
        JSON.stringify({ status: 'cooldown', wait_seconds: waitSeconds }),
        {
          headers: securityHeaders,
          status: 200,
        }
      );
    }

    // Get user's answers
    const { data: myAnswers } = await supabase
      .from('survey_answers')
      .select('question_id, answer')
      .eq('session_id', session_id);

    if (!myAnswers || myAnswers.length === 0) {
      throw new Error('No survey answers found');
    }

    // Get all active chat rooms to exclude sessions already in conversation
    const { data: activeSessions } = await supabase
      .from('chat_rooms')
      .select('session_a, session_b')
      .eq('status', 'active');

    // Create set of sessions to exclude (already in active rooms)
    const busySessionIds = new Set<string>();
    if (activeSessions) {
      for (const room of activeSessions) {
        busySessionIds.add(room.session_a);
        busySessionIds.add(room.session_b);
      }
    }
    console.log('Active room exclusion - busy sessions:', busySessionIds.size);

    // Get all other sessions with answers, filtering for freshness and test mode
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: otherSessions } = await supabase
      .from('survey_answers')
      .select('session_id, question_id, answer, guest_sessions!inner(expires_at, created_at, is_test)')
      .neq('session_id', session_id)
      .eq('guest_sessions.is_test', sessionData.is_test)
      .gt('guest_sessions.expires_at', new Date().toISOString())
      .gt('guest_sessions.created_at', tenMinutesAgo);
    
    console.log(`[Matching] Found ${otherSessions?.length || 0} potential matches (is_test=${sessionData.is_test})`);

    if (!otherSessions || otherSessions.length === 0) {
      return new Response(
        JSON.stringify({ status: 'no_match' }),
        {
          headers: securityHeaders,
          status: 200,
        }
      );
    }

    // Check blocked pairs
    const { data: blockedPairs } = await supabase
      .from('blocked_pairs')
      .select('session_b')
      .eq('session_a', session_id);

    const blockedIds = new Set(blockedPairs?.map(p => p.session_b) || []);

    // Fetch user's most recent match for cooldown check
    const { data: mySession } = await supabase
      .from('guest_sessions')
      .select('last_matched_session_id, last_matched_at')
      .eq('id', session_id)
      .single();

    // Apply 30-minute cooldown on recent match (skip for test mode)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    if (!session.is_test && // Skip cooldown for test sessions
        mySession?.last_matched_session_id && 
        mySession.last_matched_at && 
        new Date(mySession.last_matched_at) > new Date(thirtyMinutesAgo)) {
      blockedIds.add(mySession.last_matched_session_id);
      console.log(`Excluding recent match from pool: ${mySession.last_matched_session_id}`);
    }

    // Group answers by session
    const sessionAnswers = new Map<string, Map<string, string>>();
    for (const answer of otherSessions) {
      if (!sessionAnswers.has(answer.session_id)) {
        sessionAnswers.set(answer.session_id, new Map());
      }
      sessionAnswers.get(answer.session_id)!.set(answer.question_id, answer.answer);
    }

    // Calculate opposition scores
    let bestMatch = null;
    let bestScore = 0;

    for (const [otherId, otherAnswers] of sessionAnswers.entries()) {
      if (blockedIds.has(otherId)) continue;
      
      // Skip sessions already in active rooms
      if (busySessionIds.has(otherId)) {
        console.log('Skipping session already in active room:', otherId);
        continue;
      }

      // Check if potential match is a serial troll or same user
      const { data: otherSession } = await supabase
        .from('guest_sessions')
        .select('times_blocked, user_id')
        .eq('id', otherId)
        .single();

      if (otherSession && otherSession.times_blocked >= 5) {
        console.log('Skipping serial troll from matching:', otherId);
        continue;
      }

      // Only prevent self-matching in production mode (not test mode)
      if (otherSession && otherSession.user_id === session.user_id && !session.is_test) {
        console.log('Skipping self-match (production mode):', otherId);
        continue;
      }

      let differentCount = 0;
      let totalCount = 0;

      for (const myAnswer of myAnswers) {
        const otherAnswer = otherAnswers.get(myAnswer.question_id);
        if (otherAnswer) {
          totalCount++;
          if (myAnswer.answer !== otherAnswer) {
            differentCount++;
          }
        }
      }

      if (totalCount > 0) {
        const score = differentCount / totalCount;
        if (score >= 0.6 && score > bestScore) {
          bestScore = score;
          bestMatch = otherId;
        }
      }
    }

    if (!bestMatch) {
      return new Response(
        JSON.stringify({ status: 'no_match' }),
        {
          headers: securityHeaders,
          status: 200,
        }
      );
    }

    // Atomic room creation using database function with advisory locks
    const { data: matchResult, error: matchError } = await supabase
      .rpc('atomic_create_match_room', {
        _session_a: session_id,
        _session_b: bestMatch
      })
      .single();

    if (matchError) {
      console.error('Error in atomic_create_match_room:', matchError);
      throw matchError;
    }

    // Type guard for matchResult
    if (!matchResult || typeof matchResult !== 'object' || !('status' in matchResult) || !('room_id' in matchResult)) {
      throw new Error('Invalid response from atomic_create_match_room');
    }

    const result = matchResult as { room_id: string; status: 'created' | 'session_a_busy' | 'session_b_busy' };

    // Handle race condition outcomes deterministically
    if (result.status === 'session_a_busy') {
      // Current user already matched during race - redirect to their room
      console.log('Race condition: current user already in room:', result.room_id);
      return new Response(
        JSON.stringify({
          status: 'match_found',
          room_id: result.room_id,
        }),
        { headers: securityHeaders, status: 200 }
      );
    }

    if (result.status === 'session_b_busy') {
      // Best match got taken by another request - return no match
      console.log('Race condition: best match already busy:', result.room_id);
      return new Response(
        JSON.stringify({ status: 'no_match' }),
        { headers: securityHeaders, status: 200 }
      );
    }

    // Success - new room created
    const room = { id: result.room_id };

    // Update cooldown with reputation-based timing and track matched partners
    const updatePromises = [
      supabase.from('guest_sessions').update({
        next_match_at: new Date(Date.now() + baseCooldown).toISOString(),
        last_matched_session_id: bestMatch,
        last_matched_at: new Date().toISOString(),
      }).eq('id', session_id),
      
      supabase.from('guest_sessions').update({
        next_match_at: new Date(Date.now() + baseCooldown).toISOString(),
        last_matched_session_id: session_id,
        last_matched_at: new Date().toISOString(),
      }).eq('id', bestMatch)
    ];

    await Promise.all(updatePromises);

    console.log('Match found:', { room_id: room.id, score: bestScore });

    return new Response(
      JSON.stringify({
        status: 'match_found',
        room_id: room.id,
        opposition_score: bestScore,
      }),
      {
        headers: securityHeaders,
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in match-opposite:', error);
    // Don't leak sensitive error details
    return new Response(
      JSON.stringify({ error: 'Failed to process match request. Please try again.' }),
      {
        headers: securityHeaders,
        status: 500,
      }
    );
  }
});
