import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const adjectives = [
  'Bright', 'Quiet', 'Swift', 'Gentle', 'Bold', 'Calm', 'Wise', 'Kind',
  'Brave', 'Clear', 'Deep', 'Free', 'Pure', 'True', 'Warm', 'Cool'
];

const nouns = [
  'Falcon', 'River', 'Cloud', 'Forest', 'Ocean', 'Mountain', 'Valley', 'Star',
  'Moon', 'Sun', 'Wind', 'Rain', 'Dawn', 'Dusk', 'Storm', 'Breeze'
];

const avatars = ['🌊', '🌲', '🌸', '🌙', '⭐', '🔥', '🌈', '🌻', '🦋', '🐦', '🍃', '☀️'];

function generateUsername(): string {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adj}${noun}`;
}

function generateAvatar(): string {
  return avatars[Math.floor(Math.random() * avatars.length)];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const username = generateUsername();
    const avatar = generateAvatar();

    const { data: session, error } = await supabase
      .from('guest_sessions')
      .insert({
        username,
        avatar,
      })
      .select()
      .single();

    if (error) throw error;

    console.log('Created guest session:', session.id);

    return new Response(
      JSON.stringify(session),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error creating guest session:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
