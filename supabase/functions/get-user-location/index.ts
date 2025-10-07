import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Extract user's IP address from request headers
    const forwarded = req.headers.get('x-forwarded-for');
    const cfConnecting = req.headers.get('cf-connecting-ip');
    const userIP = forwarded?.split(',')[0] || cfConnecting || '';

    console.log('Attempting to geolocate IP:', userIP);

    // Use ipapi.co for free IP geolocation (1000 requests/day, no API key needed)
    const geoResponse = await fetch(`https://ipapi.co/${userIP}/json/`, {
      headers: {
        'User-Agent': 'Conversely/1.0'
      }
    });

    if (!geoResponse.ok) {
      console.error('Geolocation API error:', geoResponse.status);
      return new Response(
        JSON.stringify({ 
          country: null, 
          detectedViaIP: false,
          error: 'Geolocation service unavailable'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 // Return 200 with null country for graceful fallback
        }
      );
    }

    const geoData = await geoResponse.json();
    
    // Check for error in response (rate limit, invalid IP, etc.)
    if (geoData.error) {
      console.error('Geolocation data error:', geoData.reason);
      return new Response(
        JSON.stringify({ 
          country: null, 
          detectedViaIP: false,
          error: geoData.reason
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    const countryCode = geoData.country_code; // ISO 2-letter code (US, GB, etc.)
    const countryName = geoData.country_name;

    console.log('Detected country:', countryCode, countryName);

    return new Response(
      JSON.stringify({ 
        country: countryCode,
        countryName: countryName,
        detectedViaIP: true 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('Error in get-user-location function:', error);
    
    // Return graceful fallback on error
    return new Response(
      JSON.stringify({ 
        country: null, 
        detectedViaIP: false,
        error: 'Failed to detect location'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  }
});
