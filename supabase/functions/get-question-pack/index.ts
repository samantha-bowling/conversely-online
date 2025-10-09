import { ALL_QUESTION_IDS } from '../_shared/survey-questions.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Seeded random number generator for deterministic shuffling
function seededRandom(seed: number) {
  let state = seed;
  return function() {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

// Fisher-Yates shuffle with seeded random
function seededShuffle<T>(array: readonly T[], seed: number): T[] {
  const shuffled = [...array];
  const random = seededRandom(seed);
  
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  return shuffled;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Calculate pack_id based on 4-hour windows (6 packs per day)
    const now = Date.now();
    const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
    const packSeed = Math.floor(now / FOUR_HOURS_MS);
    
    // Generate human-readable pack_id for tracking
    const date = new Date(packSeed * FOUR_HOURS_MS);
    const packId = `${date.toISOString().split('T')[0]}-${String(date.getUTCHours()).padStart(2, '0')}`;
    
    // Deterministically shuffle questions using the seed
    const shuffled = seededShuffle(ALL_QUESTION_IDS, packSeed);
    const selectedQuestions = shuffled.slice(0, 5);
    
    console.log(`Generated question pack ${packId} with seed ${packSeed}:`, selectedQuestions);

    return new Response(
      JSON.stringify({
        pack_id: packId,
        question_ids: selectedQuestions,
        expires_at: new Date((packSeed + 1) * FOUR_HOURS_MS).toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error generating question pack:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate question pack',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
