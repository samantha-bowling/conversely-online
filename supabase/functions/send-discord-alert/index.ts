import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const DISCORD_WEBHOOK_URL = Deno.env.get('DISCORD_WEBHOOK_URL');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AlertPayload {
  title: string;
  message: string;
  severity: 'P0' | 'P1' | 'P2';
  metadata?: any;
}

// In-memory deduplication cache (resets on function restart)
const sentAlerts = new Map<string, number>();
const DEDUP_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { title, message, severity, metadata }: AlertPayload = await req.json();

    if (!DISCORD_WEBHOOK_URL) {
      console.warn('[Discord] DISCORD_WEBHOOK_URL not set, skipping notification');
      return new Response(JSON.stringify({ skipped: true, reason: 'no_webhook_url' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    // Only send P0 alerts to avoid spam
    if (severity !== 'P0') {
      console.log(`[Discord] Skipping ${severity} alert (only P0 sent)`);
      return new Response(JSON.stringify({ skipped: true, reason: 'not_p0' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    // Deduplication check
    const alertKey = `${title}-${message}`;
    const lastSent = sentAlerts.get(alertKey);
    const now = Date.now();

    if (lastSent && (now - lastSent) < DEDUP_WINDOW_MS) {
      console.log(`[Discord] Duplicate alert detected, skipping (sent ${Math.floor((now - lastSent) / 1000 / 60)}m ago)`);
      return new Response(JSON.stringify({ skipped: true, reason: 'duplicate' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    // Generate short UUID for correlation
    const alertId = crypto.randomUUID().slice(0, 8);

    const discordPayload = {
      embeds: [{
        title: `🚨 [PROD] ${severity}: ${title}`,
        description: message,
        color: 0xFF0000, // Red for P0
        fields: metadata ? [{
          name: 'Details',
          value: '```json\n' + JSON.stringify(metadata, null, 2).slice(0, 800) + '\n```'
        }] : [],
        timestamp: new Date().toISOString(),
        footer: {
          text: `Conversely Monitoring • Alert ID: ${alertId}`
        }
      }]
    };

    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(discordPayload)
    });

    if (!response.ok) {
      throw new Error(`Discord API error: ${response.status}`);
    }

    // Update dedup cache
    sentAlerts.set(alertKey, now);

    // Cleanup old entries (prevent memory leak)
    for (const [key, timestamp] of sentAlerts.entries()) {
      if (now - timestamp > DEDUP_WINDOW_MS) {
        sentAlerts.delete(key);
      }
    }

    console.log(`[Discord] P0 alert sent: ${title} (ID: ${alertId})`);

    return new Response(JSON.stringify({ sent: true, alert_id: alertId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  } catch (error) {
    console.error('[Discord] Alert send error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
