import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const securityHeaders = {
  ...corsHeaders,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const task = url.searchParams.get('task');

    if (!task) {
      return new Response(
        JSON.stringify({ success: false, error: 'Task parameter required' }),
        { status: 400, headers: { ...securityHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    console.log(`[Maintenance] Starting task: ${task}`);

    switch (task) {
      case 'cleanup_expired_messages': {
        const { error } = await supabase.rpc('cleanup_expired_messages');
        if (error) throw error;
        console.log('[Maintenance] Cleaned up expired messages');
        break;
      }

      case 'cleanup_expired_sessions': {
        const { error } = await supabase.rpc('cleanup_expired_sessions');
        if (error) throw error;
        console.log('[Maintenance] Cleaned up expired sessions');
        break;
      }

      case 'close_inactive_rooms': {
        const { error } = await supabase.rpc('close_inactive_rooms');
        if (error) throw error;
        console.log('[Maintenance] Closed inactive rooms');
        break;
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: 'Unknown task' }),
          { status: 400, headers: { ...securityHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify({ success: true, task, timestamp: new Date().toISOString() }),
      { status: 200, headers: { ...securityHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Maintenance] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...securityHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
