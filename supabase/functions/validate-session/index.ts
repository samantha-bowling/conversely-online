import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { validateSession, checkRateLimit } from '../_shared/validation.ts';

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
        JSON.stringify({ valid: false, error: 'Unauthorized - missing auth token' }),
        { headers: securityHeaders, status: 401 }
      );
    }

    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    
    if (userError || !user) {
      console.error('JWT validation error:', userError);
      return new Response(
        JSON.stringify({ valid: false, error: 'Invalid auth token' }),
        { headers: securityHeaders, status: 401 }
      );
    }

    // Look up guest session by user_id
    const { data: session, error } = await supabase
      .from('guest_sessions')
      .select('id, username, avatar, expires_at')
      .eq('user_id', user.id)
      .single();

    if (error || !session) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Session not found' }),
        { headers: securityHeaders, status: 404 }
      );
    }

    // Check if expired
    if (new Date(session.expires_at) <= new Date()) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Session expired' }),
        { headers: securityHeaders, status: 401 }
      );
    }

    console.log('Session validated for user:', user.id);

    return new Response(
      JSON.stringify({ valid: true, session }),
      { headers: securityHeaders, status: 200 }
    );
  } catch (error) {
    console.error('Error validating session:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to validate session. Please try again.' }),
      {
        headers: securityHeaders,
        status: 500,
      }
    );
  }
});
