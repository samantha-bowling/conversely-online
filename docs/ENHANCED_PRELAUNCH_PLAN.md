# 🚀 ENHANCED PRE-LAUNCH IMPLEMENTATION PLAN

**Version:** 1.0  
**Last Updated:** 2025-10-16  
**Status:** Ready for Implementation  

---

## 📋 OVERVIEW

This document contains the complete, production-ready implementation plans for three critical pre-launch features that harden Conversely's reliability, security, and compliance posture before public launch.

**Implementation Order:**
1. **Message Retry Queue** (Week 1) - Reliability
2. **Session Expiry & JWT Revocation** (Week 2) - Security  
3. **GDPR Delete/Export Functionality** (Week 3) - Compliance

---

## 1️⃣ MESSAGE RETRY QUEUE

### Problem Statement
Currently, if `send-message` edge function fails (network error, timeout, server error), the message is silently lost. Users see an error toast, but the message isn't queued for retry. This breaks trust in chat reliability.

### Solution Architecture

**Client-Side Message Queue (localStorage-based with in-memory fallback)**
- Messages pending send are stored in localStorage with unique client IDs
- On reconnect or retry, queue is processed with deduplication
- Server-side deduplication prevents double-sends
- Telemetry tracking for production monitoring
- Shadow mode deployment for safety

### Implementation Steps

#### **Step 1: Create Message Queue Hook**

**File:** `src/hooks/useMessageQueue.ts` (NEW FILE)

```typescript
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface QueuedMessage {
  clientId: string;
  roomId: string;
  content: string;
  timestamp: number;
  retryCount: number;
}

const QUEUE_KEY = 'message_send_queue';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

// ✅ Telemetry hooks
const logTelemetry = (event: string, data: any) => {
  console.log(`[MessageQueue Telemetry] ${event}:`, data);
  // TODO: Wire to telemetry_events table in production
};

export const useMessageQueue = (roomId: string, sessionId: string | null) => {
  const [queue, setQueue] = useState<QueuedMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const processingRef = useRef(false);

  // ✅ Network status listener
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      logTelemetry('network_online', { timestamp: Date.now() });
    };
    const handleOffline = () => {
      setIsOnline(false);
      logTelemetry('network_offline', { timestamp: Date.now() });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ✅ Load queue from localStorage with quota guard
  useEffect(() => {
    const loadQueue = () => {
      try {
        const stored = localStorage.getItem(QUEUE_KEY);
        if (stored) {
          const parsed: QueuedMessage[] = JSON.parse(stored);
          const roomQueue = parsed.filter(msg => msg.roomId === roomId);
          setQueue(roomQueue);
          logTelemetry('queue_loaded', { count: roomQueue.length });
        }
      } catch (error) {
        console.error('[MessageQueue] Failed to load queue:', error);
        logTelemetry('queue_load_error', { error: String(error) });
      }
    };
    loadQueue();
  }, [roomId]);

  // ✅ Persist queue with quota guard
  useEffect(() => {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    } catch (error) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.warn('[MessageQueue] localStorage quota exceeded, keeping in-memory only');
        logTelemetry('quota_exceeded', { queueLength: queue.length });
      } else {
        console.error('[MessageQueue] Failed to persist queue:', error);
      }
    }
  }, [queue]);

  // Add message to queue
  const enqueueMessage = (content: string): string => {
    const clientId = crypto.randomUUID();
    const message: QueuedMessage = {
      clientId,
      roomId,
      content,
      timestamp: Date.now(),
      retryCount: 0,
    };
    
    setQueue(prev => [...prev, message]);
    logTelemetry('message_enqueued', { clientId, roomId });
    return clientId;
  };

  // ✅ Process queue with shallow copy (race protection)
  const processQueue = async () => {
    if (processingRef.current || queue.length === 0 || !sessionId || !isOnline) {
      return;
    }

    processingRef.current = true;
    setIsProcessing(true);
    
    // ✅ Shallow copy to prevent mid-iteration mutations
    const queueSnapshot = [...queue];
    logTelemetry('queue_processing_start', { count: queueSnapshot.length });

    for (const msg of queueSnapshot) {
      if (msg.retryCount >= MAX_RETRIES) {
        console.warn('[MessageQueue] Max retries reached:', msg.clientId);
        logTelemetry('queue_drop', { clientId: msg.clientId, retries: msg.retryCount });
        setQueue(prev => prev.filter(m => m.clientId !== msg.clientId));
        continue;
      }

      try {
        console.log('[MessageQueue] Sending:', msg.clientId, 'attempt:', msg.retryCount + 1);
        
        const { data, error } = await supabase.functions.invoke('send-message', {
          body: {
            room_id: msg.roomId,
            content: msg.content,
            client_id: msg.clientId,
          },
        });

        if (error || !data?.success) {
          console.error('[MessageQueue] Send failed:', error);
          logTelemetry('queue_retry', { 
            clientId: msg.clientId, 
            attempt: msg.retryCount + 1,
            error: String(error)
          });
          
          setQueue(prev =>
            prev.map(m =>
              m.clientId === msg.clientId
                ? { ...m, retryCount: m.retryCount + 1 }
                : m
            )
          );
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        } else {
          console.log('[MessageQueue] Message sent successfully:', msg.clientId);
          logTelemetry('queue_success', { 
            clientId: msg.clientId,
            totalAttempts: msg.retryCount + 1
          });
          setQueue(prev => prev.filter(m => m.clientId !== msg.clientId));
        }
      } catch (error) {
        console.error('[MessageQueue] Unexpected error:', error);
        logTelemetry('queue_error', { 
          clientId: msg.clientId,
          error: String(error)
        });
        setQueue(prev =>
          prev.map(m =>
            m.clientId === msg.clientId
              ? { ...m, retryCount: m.retryCount + 1 }
              : m
          )
        );
      }
    }

    processingRef.current = false;
    setIsProcessing(false);
    logTelemetry('queue_processing_complete', { remaining: queue.length });
  };

  // ✅ Auto-process on reconnect
  useEffect(() => {
    if (queue.length > 0 && !processingRef.current && isOnline) {
      console.log('[MessageQueue] Auto-processing queue (online & items present)');
      processQueue();
    }
  }, [queue.length, sessionId, isOnline]);

  return {
    enqueueMessage,
    processQueue,
    queueLength: queue.length,
    isProcessing,
    isOnline,
  };
};
```

#### **Step 2: Update send-message Edge Function**

**File:** `supabase/functions/send-message/index.ts`

Add enhanced deduplication check (after line 170):

```typescript
const { room_id, content, client_id } = body as { 
  room_id: string; 
  content: string; 
  client_id?: string; 
};

// ✅ Enhanced deduplication: check room_id + content + client_id
if (client_id) {
  const { data: existing, error: dedupError } = await supabase
    .from('messages')
    .select('id')
    .eq('room_id', room_id)
    .eq('content', content)
    .gte('created_at', new Date(Date.now() - 60000).toISOString()) // Within last 60s
    .limit(1);

  if (dedupError) {
    console.error('[send-message] Deduplication check failed:', dedupError);
  } else if (existing && existing.length > 0) {
    console.log('[send-message] Duplicate detected (client_id:', client_id, ')');
    return new Response(
      JSON.stringify({ success: true, message: 'Duplicate message ignored' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  }
}
```

#### **Step 3: Integrate Queue into Chat.tsx**

**File:** `src/pages/Chat.tsx`

```typescript
// Add import
import { useMessageQueue } from '@/hooks/useMessageQueue';

// Inside Chat component (after session hooks)
const { enqueueMessage, processQueue, queueLength, isProcessing, isOnline } = useMessageQueue(
  roomId,
  session?.id || null
);

// Update handleSend function
const handleSend = async () => {
  if (!inputText.trim() || !roomId || !session || isSending) return;

  const messageText = inputText.trim();
  
  const validation = validateMessage(messageText);
  if (!validation.valid) {
    toast.error(validation.error);
    return;
  }

  setInputText("");
  setIsSending(true);

  // ✅ Enqueue message immediately
  const clientId = enqueueMessage(messageText);

  try {
    const { data, error } = await supabase.functions.invoke('send-message', {
      body: {
        room_id: roomId,
        content: messageText,
        client_id: clientId,
      },
    });

    if (error) {
      handleApiError(error, ERROR_MESSAGES.SEND_MESSAGE_FAILED);
      return;
    }

    if (!data?.success) {
      toast.error(ERROR_MESSAGES.SEND_MESSAGE_FAILED);
    }
  } catch (error) {
    handleApiError(error, ERROR_MESSAGES.SEND_MESSAGE_FAILED);
  } finally {
    setIsSending(false);
  }
};

// ✅ Trigger queue processing on reconnect
useEffect(() => {
  if (connectionStatus === 'connected' && queueLength > 0) {
    console.log('[Chat] Connection restored, processing message queue');
    processQueue();
  }
}, [connectionStatus, queueLength, processQueue]);
```

#### **Step 4: Add Visual Queue Indicator**

**File:** `src/components/chat/ChatInput.tsx`

Add badge indicator:

```typescript
{queueLength > 0 && (
  <div 
    className="absolute -top-2 -right-2 bg-warning text-warning-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center"
    role="status"
    aria-label={`${queueLength} messages queued for sending`}
  >
    {queueLength}
  </div>
)}
```

#### **Step 5: Shadow Mode Deployment**

**File:** `docs/SHADOW_MODE_DEPLOYMENT.md` (NEW FILE)

```markdown
# Shadow Mode Deployment: Message Retry Queue

## Purpose
Run the retry queue in silent monitoring mode for 24-48 hours before full activation to validate deduplication logic without risking message loss.

## Implementation

### Phase 1: Shadow Monitoring (24-48h)
1. Deploy `useMessageQueue` hook with `SHADOW_MODE = true` flag
2. Messages enqueue silently but **normal send path still executes**
3. Track telemetry events:
   - `queue_enqueued`
   - `queue_dedup_hit` (if server returned "duplicate")
   - `queue_success`
   - `queue_drop`

### Phase 2: Metrics Validation
**Green Light Criteria:**
- Dedup collision rate < 0.1% (false positives)
- Queue success rate > 99.5%
- No memory leaks (localStorage < 100 KB)
- Zero reports of double-sent messages

### Phase 3: Full Activation
1. Set `SHADOW_MODE = false`
2. Remove parallel send path
3. Messages now **depend on queue** for reliability

## Rollback Plan
If dedup collisions > 0.5% or double-sends reported:
1. Revert to commit before queue integration
2. Investigate collision root cause (likely: server-side `room_id` filter missing)
3. Fix + re-deploy shadow mode
```

### Testing Checklist

| Test Case | Expected Outcome | Status |
|-----------|------------------|--------|
| Send message while online | Message sends immediately, queue stays empty | ⬜ |
| Send message → disconnect → reconnect | Message queued, auto-sent on reconnect | ⬜ |
| Send 3 messages offline → reconnect | All 3 sent in order without duplicates | ⬜ |
| Send duplicate (rapid double-click) | Server deduplicates, only 1 message stored | ⬜ |
| Max retries exceeded | Message dropped from queue, user notified | ⬜ |
| Tab close → reopen → reconnect | Queue persists across tab closures | ⬜ |
| localStorage quota exceeded | Falls back to in-memory queue gracefully | ⬜ |
| Telemetry events fire correctly | All events logged to console (or table) | ⬜ |

---

## 2️⃣ SESSION EXPIRY & JWT REVOCATION

### Problem Statement
Currently, expired guest sessions rely on client-side expiry monitoring. If a user's JWT is still valid in Supabase auth, they can potentially regain access to expired sessions by calling edge functions directly. This undermines the "ephemeral" promise.

### Solution Architecture

**Short-Lived JWTs + Server-Side Validation**
- Reduce JWT lifetime to 1 hour (from default 24h)
- Add server-side session expiry check in all edge functions
- Request-scoped memoization to prevent redundant queries
- Grace period UX for expired sessions
- Optional: Add trigger to revoke auth sessions when guest_sessions expire

### Implementation Steps

#### **Step 1: Reduce JWT Lifetime**

**Action:** Configure Supabase Auth settings

⚠️ **IMPORTANT:** This requires manual configuration in Lovable Cloud backend

**Steps:**
1. Use the `<lov-open-backend>` action to open Lovable Cloud
2. Navigate to Authentication → Settings
3. Under "JWT Expiry", set to **3600 seconds (1 hour)**
4. Save changes

**Verification:**
```bash
# Check JWT expiry in decoded token
# exp claim should be ~ 1 hour from iat
```

#### **Step 2: Add Server-Side Session Validation Middleware**

**File:** `supabase/functions/_shared/session-validation.ts` (NEW FILE)

```typescript
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface SessionValidationResult {
  valid: boolean;
  session?: {
    id: string;
    user_id: string;
    expires_at: string;
  };
  error?: string;
}

// ✅ Request-scoped memoization cache
const validationCache = new Map<string, { result: SessionValidationResult; timestamp: number }>();
const CACHE_TTL_MS = 5000; // 5 second cache

/**
 * Validates that the guest session exists and has not expired
 * Includes request-scoped memoization to prevent redundant queries
 */
export async function validateActiveSession(
  supabase: SupabaseClient,
  userId: string
): Promise<SessionValidationResult> {
  // ✅ Check cache first
  const cached = validationCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    console.log('[Session Validation] Cache hit for user:', userId);
    return cached.result;
  }

  const now = new Date().toISOString();

  const { data: sessionData, error } = await supabase
    .from('guest_sessions')
    .select('id, user_id, expires_at')
    .eq('user_id', userId)
    .gt('expires_at', now)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  let result: SessionValidationResult;

  if (error || !sessionData) {
    console.error('[Session Validation] No active session found for user:', userId);
    result = {
      valid: false,
      error: 'Session expired or not found',
    };
  } else if (new Date(sessionData.expires_at) <= new Date()) {
    console.error('[Session Validation] Session expired:', sessionData.id);
    result = {
      valid: false,
      error: 'Session has expired',
    };
  } else {
    result = {
      valid: true,
      session: sessionData,
    };
  }

  // ✅ Cache result
  validationCache.set(userId, { result, timestamp: Date.now() });

  return result;
}

// ✅ Cleanup stale cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [userId, cache] of validationCache.entries()) {
    if (now - cache.timestamp > CACHE_TTL_MS) {
      validationCache.delete(userId);
    }
  }
}, 60000); // Clean every minute
```

#### **Step 3: Update All Edge Functions**

**Files:** All edge functions requiring session context

**Example:** `supabase/functions/send-message/index.ts`

```typescript
// Add import at top
import { validateActiveSession } from '../_shared/session-validation.ts';

// Replace session retrieval (around line 140) with:
const sessionValidation = await validateActiveSession(supabase, userId);

if (!sessionValidation.valid) {
  console.error('[send-message] Session validation failed:', sessionValidation.error);
  return new Response(
    JSON.stringify({ 
      error: sessionValidation.error,
      code: 'SESSION_EXPIRED' 
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
  );
}

const sessionData = sessionValidation.session!;
console.log(`[send-message] Session validated:`, sessionData.id);
```

**Apply to:**
- `supabase/functions/send-message/index.ts`
- `supabase/functions/end-chat/index.ts`
- `supabase/functions/submit-reflection/index.ts`
- `supabase/functions/match-opposite/index.ts`
- `supabase/functions/block-user/index.ts`

#### **Step 4: Add Client-Side Grace Period Handler**

**File:** `src/lib/error-handler.ts`

```typescript
// Update handleApiError function
export const handleApiError = (error: any, fallbackMessage?: string) => {
  console.error('API Error:', error);

  // ✅ Detect session expiry
  if (error?.message?.includes('SESSION_EXPIRED') || 
      error?.code === 'SESSION_EXPIRED') {
    if ((window as any).__handleSessionExpired) {
      (window as any).__handleSessionExpired();
    }
    return; // Don't show generic error toast
  }

  const message = error?.message || fallbackMessage || ERROR_MESSAGES.GENERIC;
  toast.error(message);
};
```

**File:** `src/contexts/SessionContext.tsx`

```typescript
// Add global handler (after line 283)
useEffect(() => {
  const handleSessionExpired = () => {
    const expiryTime = session?.expires_at 
      ? new Date(session.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';
    
    console.log('[Session] Server reported session expired');
    
    // ✅ Grace period message with timestamp
    toast.error(
      expiryTime 
        ? `Your session ended at ${expiryTime}. Please start a new conversation.`
        : 'Your session has ended. Please start a new conversation.',
      { duration: 8000 }
    );
    
    setSession(null);
    localStorage.removeItem('guest_session');
    
    // Navigate to session expired page
    setTimeout(() => {
      window.location.href = '/session-expired';
    }, 2000);
  };

  (window as any).__handleSessionExpired = handleSessionExpired;

  return () => {
    delete (window as any).__handleSessionExpired;
  };
}, [session]);
```

#### **Step 5: Optional - Database Trigger for Auth Revocation**

**File:** Create migration via database tool

```sql
-- Function to revoke auth session when guest_session expires
CREATE OR REPLACE FUNCTION revoke_expired_guest_auth()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired_user_id UUID;
BEGIN
  FOR expired_user_id IN 
    SELECT user_id 
    FROM guest_sessions
    WHERE expires_at < now()
      AND expires_at > now() - interval '1 hour' -- Only process recent expiries
  LOOP
    DELETE FROM auth.sessions
    WHERE user_id = expired_user_id;
    
    RAISE LOG 'Revoked auth session for expired guest: %', expired_user_id;
  END LOOP;
END;
$$;

-- Schedule cron job to run hourly (more efficient than every minute)
SELECT cron.schedule(
  'revoke-expired-guest-auth',
  '0 * * * *', -- Every hour
  $$SELECT revoke_expired_guest_auth()$$
);
```

**Cron Trigger Test Script:**

```sql
-- Test: Create a guest session that expires in 2 minutes
INSERT INTO guest_sessions (user_id, username, avatar, expires_at)
VALUES (
  (SELECT id FROM auth.users LIMIT 1),
  'test-expiry-user',
  '🧪',
  now() + interval '2 minutes'
);

-- Wait 3 minutes, then verify auth session was deleted
SELECT * FROM auth.sessions WHERE user_id = (SELECT user_id FROM guest_sessions WHERE username = 'test-expiry-user');
-- Should return 0 rows
```

#### **Step 6: Sync config.toml for Local Dev**

**File:** `supabase/config.toml`

Ensure JWT settings match production:

```toml
[auth]
# JWT expiry must match production (3600 seconds = 1 hour)
jwt_expiry = 3600
```

### Testing Checklist

| Test Case | Expected Outcome | Status |
|-----------|------------------|--------|
| Normal session usage | No interruption, JWT refreshes automatically | ⬜ |
| Session expires (24h) | Server rejects API calls with 401, grace period UI shows | ⬜ |
| Try to use expired session JWT | Server validates expiry, returns 401 | ⬜ |
| JWT expires (1h) but session valid | Client auto-refreshes JWT via Supabase auth | ⬜ |
| Manual JWT refresh after session expiry | Server rejects, forces new session creation | ⬜ |
| Memoization reduces DB calls | Verify cache hit logs in edge function | ⬜ |
| Cron trigger test | Expired guest session auth revoked within 1 hour | ⬜ |

---

## 3️⃣ GDPR DELETE/EXPORT FUNCTIONALITY

### Problem Statement
`PrivacyRequests.tsx` exists but shows "Coming in Phase 5B" placeholder. Users have no self-service way to delete their data or export their information, violating GDPR/CCPA expectations.

### Solution Architecture

**Self-Service Portal with Edge Functions**
- Two edge functions: `delete-user-data` and `export-user-data`
- Transactional deletion using PostgreSQL RPC
- Ephemeral audit log with hashed user IDs
- Blob streaming for large exports
- UI updates to PrivacyRequests.tsx with confirmation flow

### Implementation Steps

#### **Step 1: Create Database Migration for Audit Log**

**File:** Use database migration tool

```sql
-- Create ephemeral audit log for GDPR compliance
CREATE TABLE IF NOT EXISTS privacy_deletion_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id_hash TEXT NOT NULL, -- SHA-256 hash of user_id
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  records_deleted JSONB NOT NULL DEFAULT '{}'::jsonb, -- Count per table
  initiated_by TEXT DEFAULT 'user_self_service'
);

-- Enable RLS
ALTER TABLE privacy_deletion_events ENABLE ROW LEVEL SECURITY;

-- Policy: Only service role can read/write
CREATE POLICY "Service role full access"
  ON privacy_deletion_events
  FOR ALL
  USING (auth.role() = 'service_role');

-- ✅ Cron job to purge old deletion events (90-day retention)
CREATE OR REPLACE FUNCTION cleanup_old_deletion_events()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM privacy_deletion_events
  WHERE deleted_at < now() - interval '90 days';
  
  RAISE LOG 'Cleaned up deletion events older than 90 days';
END;
$$;

SELECT cron.schedule(
  'cleanup-deletion-events',
  '0 2 * * 0', -- Every Sunday at 2 AM
  $$SELECT cleanup_old_deletion_events()$$
);

-- ✅ Transactional deletion function (called by edge function)
CREATE OR REPLACE FUNCTION delete_user_data_transaction(target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  session_ids UUID[];
  deleted_counts JSONB;
  reflections_count INT;
  survey_count INT;
  messages_count INT;
  sessions_count INT;
BEGIN
  -- Get all session IDs for this user
  SELECT ARRAY_AGG(id) INTO session_ids
  FROM guest_sessions
  WHERE user_id = target_user_id;

  -- Delete reflections (cascade to feedback)
  DELETE FROM reflections
  WHERE session_id = ANY(session_ids);
  GET DIAGNOSTICS reflections_count = ROW_COUNT;

  -- Delete survey answers
  DELETE FROM survey_answers
  WHERE session_id = ANY(session_ids);
  GET DIAGNOSTICS survey_count = ROW_COUNT;

  -- Delete messages
  DELETE FROM messages
  WHERE session_id = ANY(session_ids);
  GET DIAGNOSTICS messages_count = ROW_COUNT;

  -- Delete guest sessions
  DELETE FROM guest_sessions
  WHERE user_id = target_user_id;
  GET DIAGNOSTICS sessions_count = ROW_COUNT;

  -- Build result JSON
  deleted_counts := jsonb_build_object(
    'reflections', reflections_count,
    'survey_answers', survey_count,
    'messages', messages_count,
    'guest_sessions', sessions_count
  );

  RETURN deleted_counts;
END;
$$;
```

#### **Step 2: Create Delete Edge Function**

**File:** `supabase/functions/delete-user-data/index.ts` (NEW FILE)

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Use service role key for deletion
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const userId = user.id;
    console.log('[delete-user-data] Processing deletion for user:', userId);

    // ✅ Hash user_id for audit log (SHA-256)
    const encoder = new TextEncoder();
    const data = encoder.encode(userId);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const userIdHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // ✅ Execute transactional deletion via RPC
    const { data: deletionResult, error: rpcError } = await supabase.rpc(
      'delete_user_data_transaction',
      { target_user_id: userId }
    );

    if (rpcError) {
      console.error('[delete-user-data] RPC deletion failed:', rpcError);
      throw new Error('Failed to delete user data');
    }

    console.log('[delete-user-data] Deletion counts:', deletionResult);

    // ✅ Log to audit table
    const { error: auditError } = await supabase
      .from('privacy_deletion_events')
      .insert({
        user_id_hash: userIdHash,
        records_deleted: deletionResult,
      });

    if (auditError) {
      console.error('[delete-user-data] Failed to log audit event:', auditError);
      // Don't fail the request if audit logging fails
    }

    // ✅ Delete auth user (cascade to auth.sessions)
    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userId);

    if (authDeleteError) {
      console.error('[delete-user-data] Failed to delete auth user:', authDeleteError);
      throw new Error('Failed to delete auth account');
    }

    console.log('[delete-user-data] Successfully deleted all data for user:', userId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'All data deleted successfully',
        records_deleted: deletionResult
      }),
      { headers: securityHeaders, status: 200 }
    );

  } catch (error) {
    console.error('[delete-user-data] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: securityHeaders, status: 500 }
    );
  }
});
```

#### **Step 3: Create Export Edge Function**

**File:** `supabase/functions/export-user-data/index.ts` (NEW FILE)

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const userId = user.id;
    console.log('[export-user-data] Processing export for user:', userId);

    // ✅ Fetch session IDs first (avoid .in(subquery))
    const { data: sessions, error: sessionsError } = await supabase
      .from('guest_sessions')
      .select('*')
      .eq('user_id', userId);

    if (sessionsError) throw sessionsError;

    const sessionIds = sessions?.map(s => s.id) || [];
    console.log('[export-user-data] Found sessions:', sessionIds.length);

    // ✅ Fetch related data explicitly
    const { data: surveyAnswers, error: surveyError } = sessionIds.length > 0
      ? await supabase.from('survey_answers').select('*').in('session_id', sessionIds)
      : { data: [], error: null };

    if (surveyError) throw surveyError;

    const { data: reflections, error: reflectionsError } = sessionIds.length > 0
      ? await supabase.from('reflections').select('*').in('session_id', sessionIds)
      : { data: [], error: null };

    if (reflectionsError) throw reflectionsError;

    const { data: messages, error: messagesError } = sessionIds.length > 0
      ? await supabase
          .from('messages')
          .select('*')
          .in('session_id', sessionIds)
          .gt('expires_at', new Date().toISOString())
      : { data: [], error: null };

    if (messagesError) throw messagesError;

    // ✅ Compile export package
    const exportData = {
      export_timestamp: new Date().toISOString(),
      user_id: userId,
      sessions: sessions || [],
      survey_answers: surveyAnswers || [],
      reflections: reflections || [],
      messages: messages || [],
      metadata: {
        total_sessions: sessions?.length || 0,
        total_survey_answers: surveyAnswers?.length || 0,
        total_reflections: reflections?.length || 0,
        total_messages: messages?.length || 0,
      },
    };

    console.log('[export-user-data] Export complete:', exportData.metadata);

    // ✅ Use Blob streaming for large exports
    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });

    return new Response(
      blob,
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="conversely-data-export-${Date.now()}.json"`
        }, 
        status: 200 
      }
    );

  } catch (error) {
    console.error('[export-user-data] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
```

#### **Step 4: Update PrivacyRequests UI**

**File:** `src/pages/PrivacyRequests.tsx`

```typescript
import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Download, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

const PrivacyRequests = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('export-user-data', {
        body: {},
      });

      if (error) throw error;

      // Trigger download using Blob
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `conversely-data-export-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Data exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export data');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete-user-data', {
        body: {},
      });

      if (error) throw error;

      toast.success('All data deleted successfully. You will now be signed out.');
      
      // Sign out and redirect to home
      await supabase.auth.signOut();
      setTimeout(() => {
        window.location.href = '/';
      }, 1500);
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete data');
      setIsDeleting(false);
    }
  };

  // ✅ Focus management for accessibility
  const handleShowDeleteConfirm = () => {
    setShowDeleteConfirm(true);
    setTimeout(() => deleteButtonRef.current?.focus(), 100);
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-12 max-w-2xl">
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold">Privacy Requests</h1>
            <p className="text-muted-foreground">
              Exercise your data protection rights
            </p>
          </div>

          {/* Export Data Card */}
          <Card>
            <CardHeader>
              <CardTitle>Export My Data</CardTitle>
              <CardDescription>
                Download a copy of all your data (GDPR Article 15)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This will export:
              </p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li>Guest sessions</li>
                <li>Survey responses</li>
                <li>Reflections and feedback</li>
                <li>Active messages (non-expired)</li>
              </ul>
              <Button
                onClick={handleExport}
                disabled={isExporting}
                className="w-full"
              >
                {isExporting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Exporting...</>
                ) : (
                  <><Download className="w-4 h-4 mr-2" /> Export Data</>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Delete Data Card */}
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Delete My Data</CardTitle>
              <CardDescription>
                Permanently delete all your data (GDPR Article 17)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-destructive mb-2">Warning</p>
                    <p className="text-sm text-muted-foreground">
                      This action is <strong>permanent and cannot be undone</strong>. All your sessions, 
                      messages, and survey responses will be deleted. 
                      <strong className="block mt-1">This will sign you out automatically.</strong>
                    </p>
                  </div>
                </div>
              </div>

              {!showDeleteConfirm ? (
                <Button
                  variant="destructive"
                  onClick={handleShowDeleteConfirm}
                  className="w-full"
                >
                  <Trash2 className="w-4 h-4 mr-2" /> Request Data Deletion
                </Button>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Are you absolutely sure?</p>
                  <div className="flex gap-2">
                    <Button
                      ref={deleteButtonRef}
                      variant="destructive"
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="flex-1"
                    >
                      {isDeleting ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Deleting...</>
                      ) : (
                        'Yes, Delete Everything'
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default PrivacyRequests;
```

#### **Step 5: Add to config.toml**

**File:** `supabase/config.toml`

```toml
[functions.delete-user-data]
verify_jwt = true

[functions.export-user-data]
verify_jwt = true
```

#### **Step 6: Update Privacy Policy**

**File:** `public/legal/privacy.md`

Add section:

```markdown
## 7. Exercising Your Privacy Rights

You have the right to access, correct, or delete your personal data. You can exercise these rights through our self-service portal:

### Self-Service Privacy Portal
Visit [/privacy-requests](/privacy-requests) to:

- **Data Access & Portability (GDPR Article 15)**: Export all your data in machine-readable JSON format
  - Guest sessions
  - Survey responses
  - Reflections and feedback
  - Active messages (non-expired)

- **Right to Erasure (GDPR Article 17)**: Request permanent deletion of all your data
  - All sessions, messages, reflections, and survey answers will be deleted
  - Your authentication account will be removed
  - This action is irreversible and will sign you out immediately

### Processing Timelines
- **Export requests**: Processed immediately (< 5 seconds)
- **Deletion requests**: Processed immediately, with confirmation (< 10 seconds)

### Audit & Compliance
- All deletion requests are logged (anonymized) for 90 days for compliance verification
- Deletion logs contain only hashed user IDs and record counts (no personal data)
```

### Testing Checklist

| Test Case | Expected Outcome | Status |
|-----------|------------------|--------|
| Export data (new session) | JSON file downloads with session, empty arrays for other data | ⬜ |
| Export data (after chat) | JSON includes messages, reflections, survey answers | ⬜ |
| Delete data → confirm | All data deleted, user signed out, redirected to home | ⬜ |
| Delete data → cancel | No action taken, UI returns to normal | ⬜ |
| Try to access app after deletion | No session found, forced to create new | ⬜ |
| Export after deletion | New export only includes new data | ⬜ |
| Transactional deletion | All tables deleted atomically (no partial deletions) | ⬜ |
| Audit log created | `privacy_deletion_events` records hashed user_id + counts | ⬜ |
| Focus management | Delete confirmation buttons receive focus correctly | ⬜ |

---

## 🚀 DEPLOYMENT ROADMAP

### Week 1: Message Retry Queue
**Days 1-2:** Implementation
- Create `useMessageQueue.ts` hook
- Update `send-message` edge function
- Integrate into `Chat.tsx`
- Add visual indicator

**Days 3-4:** Shadow Mode Deployment
- Deploy with `SHADOW_MODE = true`
- Monitor telemetry for 24-48h
- Validate dedup collision rate < 0.1%

**Day 5:** Full Activation
- Set `SHADOW_MODE = false`
- Monitor production for 24h
- Verify queue success rate > 99.5%

### Week 2: Session Expiry & JWT Revocation
**Day 1:** Backend Configuration
- Set JWT expiry to 3600s in Lovable Cloud
- Create `session-validation.ts` middleware
- Deploy cron trigger

**Days 2-3:** Edge Function Updates
- Update all 5 edge functions
- Add memoization cache
- Test validation flow

**Days 4-5:** Client-Side Integration
- Update error handler
- Add grace period UI
- Test session expiry flows

### Week 3: GDPR Compliance
**Day 1:** Database Setup
- Create `privacy_deletion_events` table
- Create `delete_user_data_transaction` RPC
- Deploy cron cleanup job

**Days 2-3:** Edge Functions
- Create `delete-user-data` function
- Create `export-user-data` function
- Test transactional deletion

**Days 4-5:** UI & Documentation
- Update `PrivacyRequests.tsx`
- Update `privacy.md`
- Comprehensive testing

---

## ✅ "GREEN LIGHT" CONDITIONS FOR LAUNCH

Ship to production when ALL of the following are verified:

### Message Retry Queue
- [ ] Shadow mode ran for 24-48h with dedup collision rate < 0.1%
- [ ] Queue success rate > 99.5% in production
- [ ] Offline → reconnect flow tested successfully
- [ ] localStorage quota exceeded handled gracefully
- [ ] Telemetry events firing correctly

### Session Expiry & JWT Revocation
- [ ] JWT expiry set to 3600s in Lovable Cloud
- [ ] All 5 edge functions using `validateActiveSession`
- [ ] Expired session produces clean 401 → grace period UI flow
- [ ] Memoization cache hit rate > 80% (check logs)
- [ ] Cron trigger test passed (auth session revoked)

### GDPR Compliance
- [ ] Export downloads valid JSON with all user data
- [ ] Delete confirmation requires explicit "Yes" click
- [ ] Transactional deletion verified (no partial deletions)
- [ ] Audit log records created with hashed user_id
- [ ] Post-delete, user cannot access old data
- [ ] Privacy policy updated with self-service portal info

### General
- [ ] All features documented in `LAUNCH_CHECKLIST.md`
- [ ] Chaos tests passed (Realtime outage, session expiry mid-queue)
- [ ] No console errors in production for 24h
- [ ] Edge function error rate < 0.5%

---

## 🧪 CHAOS TEST SCENARIOS

### Test 1: Realtime Outage Mid-Retry
1. Send message offline (queued)
2. Reconnect → start processing queue
3. Kill Realtime connection mid-send
4. **Expected:** Retry continues, message eventually sent

### Test 2: Session Expiry with Queued Messages
1. Send 3 messages offline (queued)
2. Manually expire session (set `expires_at` to past)
3. Reconnect → queue attempts to process
4. **Expected:** 401 errors, grace period UI shown, queue cleared

### Test 3: Concurrent Delete During Export
1. Start data export
2. Immediately click "Delete My Data" → confirm
3. **Expected:** Both complete successfully (export may be stale, but no errors)

---

## 📊 TELEMETRY EVENTS REFERENCE

| Event | Fired When | Data Logged |
|-------|-----------|-------------|
| `queue_enqueued` | Message added to queue | `clientId`, `roomId` |
| `queue_retry` | Message retry attempt | `clientId`, `attempt`, `error` |
| `queue_success` | Message sent successfully | `clientId`, `totalAttempts` |
| `queue_drop` | Message dropped (max retries) | `clientId`, `retries` |
| `queue_load_error` | localStorage read fails | `error` |
| `quota_exceeded` | localStorage quota hit | `queueLength` |
| `network_online` | Browser reports online | `timestamp` |
| `network_offline` | Browser reports offline | `timestamp` |

---

## 🔄 ROLLBACK PROCEDURES

### Message Retry Queue
**Symptom:** Dedup collision rate > 0.5% or double-sends reported

**Action:**
1. Revert to commit before queue integration
2. Investigate collision root cause (likely: `room_id` filter missing in server dedup)
3. Fix + re-deploy shadow mode

### Session Expiry
**Symptom:** Users logged out prematurely or can't send messages

**Action:**
1. Increase JWT expiry to 7200s (2h) in Lovable Cloud
2. Check edge function logs for false-positive expiry detections
3. Verify `expires_at` column not prematurely set

### GDPR Portal
**Symptom:** Partial deletions or export failures

**Action:**
1. Disable `delete-user-data` function (set `verify_jwt = false` temporarily)
2. Manually verify RPC transaction logic in SQL
3. Test on staging user before re-enabling

---

## 📚 SUPPORTING DOCUMENTATION

- `docs/LAUNCH_CHECKLIST.md` - Pre-launch verification procedures
- `docs/SHADOW_MODE_DEPLOYMENT.md` - Retry queue shadow mode guide
- `docs/MONITORING_QUERIES.md` - Production health queries
- `docs/INCIDENT_RESPONSE.md` - Emergency response playbook

---

## ✍️ SIGN-OFF CHECKLIST

Before marking this plan as "Complete", verify:

- [ ] All code reviewed by at least one other developer
- [ ] All test checklists completed (100% pass rate)
- [ ] Production deployment tested in staging first
- [ ] Telemetry dashboard shows healthy metrics for 48h
- [ ] Privacy policy updates reviewed by legal/compliance (if applicable)
- [ ] User-facing documentation updated (Help Center, FAQ)
- [ ] Incident response runbook updated with new edge functions

**Approved By:** ________________  
**Date:** ________________  
**Production Deploy Date:** ________________

---

*End of Enhanced Pre-Launch Implementation Plan*
