import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { checkRateLimit, logError, logInfo } from '../_shared/validation.ts';

const FUNCTION_NAME = 'create-guest-session';
const SITE_URL = Deno.env.get('SITE_URL') || 'https://conversely.app';
const IS_DEV = Deno.env.get('ENVIRONMENT') === 'development';

const corsHeaders = {
  'Access-Control-Allow-Origin': IS_DEV ? '*' : SITE_URL,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-consent-given',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const securityHeaders = {
  ...corsHeaders,
  'Content-Type': 'application/json',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': "default-src 'none'; script-src 'none'; connect-src 'self'; img-src 'none'; style-src 'none'",
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=()',
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
      logInfo(FUNCTION_NAME, 'Session creation attempted without consent flag', {});
    }

    // Rate limiting: 10 sessions per IP per hour
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    
    const rateLimitKey = `create-session:${clientIp}`;
    const rateLimit = checkRateLimit(rateLimitKey, 10, 3600000); // 10 per hour

    if (!rateLimit.allowed) {
      logInfo(FUNCTION_NAME, 'Rate limit exceeded', { clientIp });
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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      logError(FUNCTION_NAME, 'Missing Authorization header', new Error('No auth header'));
      return new Response(
        JSON.stringify({ error: 'Unauthorized - no auth session provided' }),
        { headers: securityHeaders, status: 401 }
      );
    }
    
    const accessToken = authHeader.replace(/^Bearer\s+/i, '');

    // 1) Verify user with anon client (no RLS bypass)
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    // 2) Create service role client for DB operations
    const dbClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    // Verify auth context - ensure we have a valid JWT
    const { data: { user }, error: getUserError } = await authClient.auth.getUser(accessToken);
    
    if (getUserError || !user) {
      logError(FUNCTION_NAME, 'Auth verification failed', getUserError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized - invalid auth session' }),
        { headers: securityHeaders, status: 401 }
      );
    }

    logInfo(FUNCTION_NAME, 'Authenticated user', { user_id: user.id });

    // Parse request body for is_test flag
    const req_body = await req.json().catch(() => ({}));
    const isTest = req_body.is_test || false;
    
    logInfo(FUNCTION_NAME, 'Creating guest session', { is_test: isTest });

    const username = generateUsername();
    const avatar = generateAvatar();

    // Insert guest session - user_id explicitly set from verified JWT
    const { data: session, error } = await dbClient
      .from('guest_sessions')
      .insert({
        username,
        avatar,
        user_id: user.id,  // Explicitly set from verified JWT
        is_test: isTest
      })
      .select()
      .single();

    if (error) {
      logError(FUNCTION_NAME, 'Database error', error);
      throw error;
    }

    logInfo(FUNCTION_NAME, 'Session created', {
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
    logError(FUNCTION_NAME, 'Unexpected error creating guest session', error);
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
