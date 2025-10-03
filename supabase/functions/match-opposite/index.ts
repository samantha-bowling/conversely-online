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

    const body = await req.json();
    const { session_id } = body;

    // Validate session_id format (UUID)
    if (!session_id || typeof session_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(session_id)) {
      return new Response(
        JSON.stringify({ error: 'Invalid session ID' }),
        { headers: securityHeaders, status: 400 }
      );
    }

    // Rate limiting: 5 match attempts per hour per session
    const rateLimitKey = `match-opposite:${session_id}`;
    const rateLimit = checkRateLimit(rateLimitKey, 5, 3600000); // 5 per hour

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

    // Check cooldown
    const { data: session } = await supabase
      .from('guest_sessions')
      .select('next_match_at')
      .eq('id', session_id)
      .single();

    if (session && new Date(session.next_match_at) > new Date()) {
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

    // Get all other sessions with answers
    const { data: otherSessions } = await supabase
      .from('survey_answers')
      .select('session_id, question_id, answer')
      .neq('session_id', session_id);

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

    // Create chat room
    const { data: room, error: roomError } = await supabase
      .from('chat_rooms')
      .insert({
        session_a: session_id,
        session_b: bestMatch,
      })
      .select()
      .single();

    if (roomError) throw roomError;

    // Update cooldown (90 seconds)
    await supabase
      .from('guest_sessions')
      .update({
        next_match_at: new Date(Date.now() + 90000).toISOString(),
      })
      .eq('id', session_id);

    await supabase
      .from('guest_sessions')
      .update({
        next_match_at: new Date(Date.now() + 90000).toISOString(),
      })
      .eq('id', bestMatch);

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
