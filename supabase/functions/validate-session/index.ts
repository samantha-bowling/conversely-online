import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { validateSession } from '../_shared/validation.ts';

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

    const body = await req.json();
    const { session_id } = body;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!session_id || !uuidRegex.test(session_id)) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Invalid session ID format' }),
        { headers: securityHeaders, status: 400 }
      );
    }

    console.log('Validating session:', session_id);

    const result = await validateSession(supabase, session_id);

    if (!result.valid) {
      console.log('Session validation failed:', result.error);
      return new Response(
        JSON.stringify({ valid: false, error: result.error }),
        {
          headers: securityHeaders,
          status: 401,
        }
      );
    }

    console.log('Session validated successfully:', result.session?.id);

    return new Response(
      JSON.stringify({
        valid: true,
        session: result.session,
      }),
      {
        headers: securityHeaders,
        status: 200,
      }
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
