import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { checkRateLimit, BLOCKED_PATTERNS, normalizeForDetection } from '../_shared/validation.ts';
import { RATE_LIMIT_CONFIG } from '../_shared/rate-limit-config.ts';

// Heartbeat configuration for ghost account prevention
const MATCH_HEARTBEAT_TTL_MS = 15000; // Match requires 15s freshness
const HEARTBEAT_DRIFT_MS = 2000;      // Clock skew buffer

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

/**
 * Content validation using centralized patterns from _shared/validation.ts
 * Checks both raw text and normalized version (handles leetspeak, unicode tricks)
 */
function containsBlockedContent(text: string): boolean {
  const normalized = normalizeForDetection(text);
  return BLOCKED_PATTERNS.some(pattern => 
    pattern.test(text) || pattern.test(normalized)
  );
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
    // Note: user_id is included here for self-match prevention logic, but never returned to clients
    const { data: sessionData, error: sessionError } = await supabase
      .from('guest_sessions')
      .select('id, username, avatar, expires_at, is_test, reputation_score, quick_exits, last_matched_session_id, last_matched_at, next_match_at, is_searching, last_heartbeat_at, times_blocked, last_quick_exit, created_at, user_id')
      .eq('user_id', user.id)
      .single();

    if (sessionError || !sessionData) {
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { headers: securityHeaders, status: 404 }
      );
    }

    const session_id = sessionData.id;

    // Rate limiting using centralized config
    const rateLimitKey = `match-opposite:${session_id}`;
    const rateLimit = checkRateLimit(
      rateLimitKey, 
      RATE_LIMIT_CONFIG.MAX_REQUESTS, 
      RATE_LIMIT_CONFIG.WINDOW_MS
    );

    if (!rateLimit.allowed) {
      console.warn(
        `[RateLimit] Session ${session_id} exceeded limit (${RATE_LIMIT_CONFIG.DESCRIPTION})`,
        { retry_after: rateLimit.retryAfter }
      );
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

    // GHOST ACCOUNT PROTECTION:
    // - Client heartbeats: Every 15s
    // - Matching window: 15s + 2s drift (allows 1 missed beat + clock skew)
    // - Max ghost visibility: ~32s total (15s last beat + 15s timeout + 2s drift)
    // - This prevents matching with users who just closed their tab/browser
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const heartbeatCutoff = new Date(Date.now() - (MATCH_HEARTBEAT_TTL_MS + HEARTBEAT_DRIFT_MS)).toISOString();
    // Allow newly created sessions a 3-second grace period on is_searching check
    const threeSecondsAgo = new Date(Date.now() - 3000).toISOString();
    const { data: otherSessions } = await supabase
      .from('survey_answers')
      .select('session_id, question_id, answer, guest_sessions!inner(expires_at, created_at, is_test, is_searching, last_heartbeat_at, times_blocked)')
      .neq('session_id', session_id)
      .eq('guest_sessions.is_test', sessionData.is_test)
      .or(`is_searching.eq.true,created_at.gt.${threeSecondsAgo}`, { foreignTable: 'guest_sessions' })
      .gt('guest_sessions.expires_at', new Date().toISOString())
      .gt('guest_sessions.created_at', tenMinutesAgo)
      .gt('guest_sessions.last_heartbeat_at', heartbeatCutoff) // Tightened from 30s to 17s (15s + 2s drift)
      .lt('guest_sessions.times_blocked', 5);
    
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
      // Note: user_id is legitimately needed here to prevent self-matching
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

    // Update cooldown, track matched partners, and mark both as no longer searching
    const updatePromises = [
      supabase.from('guest_sessions').update({
        next_match_at: new Date(Date.now() + baseCooldown).toISOString(),
        last_matched_session_id: bestMatch,
        last_matched_at: new Date().toISOString(),
        is_searching: false,
      }).eq('id', session_id),
      
      supabase.from('guest_sessions').update({
        next_match_at: new Date(Date.now() + baseCooldown).toISOString(),
        last_matched_session_id: session_id,
        last_matched_at: new Date().toISOString(),
        is_searching: false,
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
