import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Cache management
let cachedResult: { level: string; message: string; icon: string } | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION_MS = 30000; // 30 seconds

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check cache first
    const now = Date.now();
    if (cachedResult && (now - cacheTimestamp) < CACHE_DURATION_MS) {
      console.log('Returning cached activity level');
      return new Response(
        JSON.stringify(cachedResult),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Querying available users for activity level');

    // Query for available users
    // Users are considered available if they:
    // 1. Have completed the survey (at least 5 answers)
    // 2. Are not in cooldown (next_match_at <= now)
    // 3. Haven't been blocked excessively (times_blocked < 5)
    // 4. Session hasn't expired
    const { data: sessions, error: sessionsError } = await supabase
      .from('guest_sessions')
      .select('id, next_match_at, times_blocked, expires_at')
      .lt('times_blocked', 5)
      .gt('expires_at', new Date().toISOString())
      .lte('next_match_at', new Date().toISOString());

    if (sessionsError) {
      console.error('Error querying sessions:', sessionsError);
      throw sessionsError;
    }

    // Filter sessions that have completed the survey
    const sessionIds = sessions?.map(s => s.id) || [];
    
    let availableCount = 0;
    
    if (sessionIds.length > 0) {
      const { data: answersData, error: answersError } = await supabase
        .from('survey_answers')
        .select('session_id')
        .in('session_id', sessionIds);

      if (answersError) {
        console.error('Error querying survey answers:', answersError);
        throw answersError;
      }

      // Count unique sessions with at least 5 answers
      const answerCounts = new Map<string, number>();
      answersData?.forEach(answer => {
        answerCounts.set(answer.session_id, (answerCounts.get(answer.session_id) || 0) + 1);
      });

      availableCount = Array.from(answerCounts.values()).filter(count => count >= 5).length;
    }

    console.log(`Found ${availableCount} available users`);

    // Apply enhanced fuzzing: ±3-5 random variance for better privacy
    const fuzzAmount = Math.floor(Math.random() * 7) - 3; // -3 to +3
    const fuzzedWithVariance = Math.max(0, availableCount + fuzzAmount);
    
    // Bucket to nearest 5 to reduce precision
    const fuzzedCount = Math.round(fuzzedWithVariance / 5) * 5;

    console.log(`Fuzzed count: ${fuzzedCount} (original: ${availableCount})`);

    // Determine activity level based on fuzzed count
    let level: string;
    let message: string;
    let icon: string;

    if (fuzzedCount <= 5) {
      level = 'quiet';
      message = 'Very few people online right now';
      icon = '🔴';
    } else if (fuzzedCount <= 15) {
      level = 'building';
      message = 'Some people are joining';
      icon = '🟡';
    } else {
      level = 'active';
      message = 'Good time to match!';
      icon = '🟢';
    }

    const result = { level, message, icon };

    // Cache the result
    cachedResult = result;
    cacheTimestamp = now;

    console.log('Activity level result:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-activity-level:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get activity level' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
