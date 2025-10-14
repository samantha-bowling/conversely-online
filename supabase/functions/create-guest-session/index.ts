import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { checkRateLimit, logRateLimit, extractClientIp } from '../_shared/validation.ts';
import { RATE_LIMIT_CONFIG } from '../_shared/rate-limit-config.ts';

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

async function verifyHCaptcha(token: string, clientIp: string): Promise<boolean> {
  const secretKey = Deno.env.get('HCAPTCHA_SECRET_KEY');
  
  if (!secretKey) {
    console.error('[hCaptcha] Secret key not configured');
    throw new Error('Captcha verification not configured');
  }

  const startTime = performance.now();
  
  try {
    const response = await fetch('https://hcaptcha.com/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        secret: secretKey,
        response: token,
        remoteip: clientIp,
      }),
    });

    const data = await response.json();
    const latencyMs = Math.round(performance.now() - startTime);
    
    console.log('[hCaptcha] Verification result:', {
      event: 'captcha_verification',
      success: data.success,
      ip: clientIp,
      latency_ms: latencyMs,
      error_codes: data['error-codes'],
    });

    return data.success === true;
  } catch (error) {
    console.error('[hCaptcha] Verification request failed:', error);
    throw new Error('Captcha verification failed');
  }
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
    const clientIp = extractClientIp(req);
    
    const rateLimitKey = `create-session:${clientIp}`;
    const rateLimit = checkRateLimit(
      rateLimitKey,
      RATE_LIMIT_CONFIG.CREATE_SESSION.MAX_REQUESTS,
      RATE_LIMIT_CONFIG.CREATE_SESSION.WINDOW_MS
    );

    if (!rateLimit.allowed) {
      logRateLimit('create-guest-session', clientIp, rateLimit.retryAfter ?? 0);
      return new Response(
        JSON.stringify({
          error: 'Too many session requests. Please try again later.',
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

    // Extract token from Authorization header
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing Authorization header');
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
      console.error('Auth verification failed:', getUserError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized - invalid auth session' }),
        { headers: securityHeaders, status: 401 }
      );
    }

    console.log('Authenticated user:', user.id);

    // Parse and validate request body
    const req_body = await req.json().catch(() => null);
    
    if (!req_body || typeof req_body !== 'object') {
      console.error('[Session] Invalid payload structure');
      return new Response(
        JSON.stringify({ 
          success: false,
          code: 'invalid_payload',
          error: 'Invalid request payload' 
        }),
        { headers: securityHeaders, status: 400 }
      );
    }

    const isTest = req_body.is_test || false;
    const captchaToken = req_body.captcha_token;
    
    console.log('[Session] Creating guest session, is_test:', isTest);

    // hCaptcha verification (skip in test mode)
    if (!isTest) {
      if (!captchaToken || typeof captchaToken !== 'string') {
        console.warn('[Session] Missing captcha token');
        return new Response(
          JSON.stringify({ 
            success: false,
            code: 'captcha_required',
            error: 'Captcha verification required' 
          }),
          { headers: securityHeaders, status: 403 }
        );
      }

      const captchaValid = await verifyHCaptcha(captchaToken, clientIp);
      
      if (!captchaValid) {
        console.warn('[Session] Captcha verification failed for IP:', clientIp);
        return new Response(
          JSON.stringify({ 
            success: false,
            code: 'captcha_verification_failed',
            error: 'Captcha verification failed' 
          }),
          { headers: securityHeaders, status: 403 }
        );
      }
      
      console.log('[Session] Captcha verified successfully');
    } else {
      console.log('[Session] Skipping captcha verification (test mode)');
    }

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
