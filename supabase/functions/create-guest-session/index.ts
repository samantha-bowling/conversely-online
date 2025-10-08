import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { checkRateLimit } from '../_shared/validation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-consent-given',
};

const securityHeaders = {
  ...corsHeaders,
  'Content-Type': 'application/json',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
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
    // Check for consent header (logged for compliance)
    const hasConsent = req.headers.get('x-consent-given') === 'true';
    if (!hasConsent) {
      console.warn('Session creation attempted without consent flag');
    }

    // Rate limiting: 10 sessions per IP per hour
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    
    const rateLimitKey = `create-session:${clientIp}`;
    const rateLimit = checkRateLimit(rateLimitKey, 10, 3600000); // 10 per hour

    if (!rateLimit.allowed) {
      console.log('Rate limit exceeded for IP:', clientIp);
      return new Response(
        JSON.stringify({
          error: 'Too many session requests. Please try again later.',
          retry_after: rateLimit.retryAfter,
        }),
        {
          headers: securityHeaders,
          status: 429,
        }
      );
    }

    // Extract token from Authorization header
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing Authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized - no auth session provided' }),
        { headers: securityHeaders, status: 401 }
      );
    }
    
    const accessToken = authHeader.replace(/^Bearer\s+/i, '');

    // Create client with proper config
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    // CRITICAL: Inject the caller's session so PostgREST uses it
    await supabase.auth.setSession({ 
      access_token: accessToken, 
      refresh_token: '' 
    });

    // Verify auth context - ensure we have a valid JWT
    const { data: { user }, error: getUserError } = await supabase.auth.getUser(accessToken);
    
    if (getUserError || !user) {
      console.error('Auth verification failed:', getUserError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized - invalid auth session' }),
        { headers: securityHeaders, status: 401 }
      );
    }

    console.log('Authenticated user:', user.id);

    const username = generateUsername();
    const avatar = generateAvatar();

    // Insert guest session - user_id will be auto-set by DEFAULT auth.uid()
    const { data: session, error } = await supabase
      .from('guest_sessions')
      .insert({
        username,
        avatar,
        // DO NOT set user_id here - let the database trigger handle it
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      throw error;
    }

    console.log('Session created', {
      sessionId: session.id,
      userId: user.id,
      username: username,
      hasConsent: hasConsent,
      timestamp: new Date().toISOString()
    });

    // Return session data (NO auth tokens - already set in browser)
    return new Response(
      JSON.stringify(session),
      {
        headers: securityHeaders,
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error creating guest session:', error);
    // Don't leak sensitive error details to client
    return new Response(
      JSON.stringify({ error: 'Failed to create session. Please try again.' }),
      {
        headers: securityHeaders,
        status: 500,
      }
    );
  }
});
