# hCaptcha Integration Plan

## Overview

This document outlines the production-ready implementation plan for integrating hCaptcha into the Conversely platform to prevent bot abuse during session creation. The integration uses **invisible hCaptcha** triggered during the AgeGate flow, just before session initialization.

## Architecture

```
User Flow:
1. User completes age verification
2. User accepts Terms & Privacy Policy
3. User clicks "Let's Get Started"
4. → hCaptcha executes (invisible, async)
5. → Token sent to backend for verification
6. → Session created if valid
7. → User redirected to Survey
```

## Implementation Checklist

### Phase 1: Frontend Integration

#### 1.1 Install Dependencies
```bash
npm install @hcaptcha/react-hcaptcha
```

#### 1.2 Update AgeGate Component (`src/components/AgeGate.tsx`)

**Key Changes:**
- Add promise-based token resolution (prevents race conditions)
- Integrate invisible hCaptcha component
- Add accessibility attributes
- Implement contextual error handling

**Code Additions:**

```typescript
import HCaptcha from '@hcaptcha/react-hcaptcha';

// Add state for captcha handling
const captchaRef = useRef<HCaptcha | null>(null);
const [captchaTokenResolver, setCaptchaTokenResolver] = useState<{\
  resolve: (token: string) => void;
  reject: (error: Error) => void;
} | null>(null);

// Promise-based token handler
const getCaptchaToken = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    setCaptchaTokenResolver({ resolve, reject });
    
    const timeout = setTimeout(() => {
      reject(new Error('Captcha verification timeout'));
    }, 10000);
    
    // Cleanup on resolve/reject
    const cleanup = () => clearTimeout(timeout);
    resolve = ((token: string) => { cleanup(); resolve(token); }) as any;
    reject = ((error: Error) => { cleanup(); reject(error); }) as any;
    
    captchaRef.current?.execute();
  });
};

// Verification callback
const handleCaptchaVerify = (token: string) => {
  if (captchaTokenResolver) {
    captchaTokenResolver.resolve(token);
    setCaptchaTokenResolver(null);
  }
};

// Error callback
const handleCaptchaError = (err: string) => {
  if (captchaTokenResolver) {
    captchaTokenResolver.reject(new Error(err));
    setCaptchaTokenResolver(null);
  }
  
  // Contextual error messages
  if (err.includes('network')) {
    toast.error('Connection issue. Please check your internet and try again.');
  } else {
    toast.error('Verification failed. Please retry.');
  }
};

// Update handleContinue function
const handleContinue = async () => {
  if (submitting || !isEligible) return;
  
  setSubmitting(true);
  
  try {
    // Validate eligibility
    if (!isEligible) {
      toast.error("You must be 18 or older to use this service");
      setSubmitting(false);
      return;
    }

    // Check legal acceptance
    if (!hasAcceptedTerms || !hasAcceptedPrivacy) {
      toast.error("Please accept the Terms of Service and Privacy Policy");
      setSubmitting(false);
      return;
    }

    // Execute hCaptcha and wait for token
    let captchaToken: string | undefined;
    try {
      captchaToken = await getCaptchaToken();
    } catch (captchaError) {
      console.error('hCaptcha verification failed:', captchaError);
      toast.error(ERROR_MESSAGES.SESSION_CREATE_ERROR);
      setSubmitting(false);
      return;
    }

    // Record legal acceptance
    await recordLegalAcceptance(
      country,
      year ? parseInt(year) : 0,
      month ? parseInt(month) : 0,
      day ? parseInt(day) : 0
    );

    // Initialize session with captcha token
    await initializeSession(captchaToken);
    
    onAccept();
    navigate('/survey');
  } catch (error) {
    console.error('Error in age gate flow:', error);
    toast.error(ERROR_MESSAGES.SESSION_CREATE_ERROR);
  } finally {
    setSubmitting(false);
  }
};
```

**JSX Addition (before closing Dialog.Content):**
```tsx
{/* hCaptcha - Invisible Mode */}
<HCaptcha
  ref={captchaRef}
  sitekey={import.meta.env.VITE_HCAPTCHA_SITE_KEY}
  onVerify={handleCaptchaVerify}
  onError={handleCaptchaError}
  onExpire={() => handleCaptchaError('Token expired')}
  size="invisible"
  aria-hidden="true"
/>

{/* Fallback for users with JavaScript disabled */}
<noscript>
  <p className="text-xs text-muted-foreground mt-2">
    Please enable JavaScript to verify you're human.
  </p>
</noscript>
```

**Environment Variable Check:**
```typescript
// Add to top of component or in a useEffect
if (!import.meta.env.VITE_HCAPTCHA_SITE_KEY) {
  console.warn('Missing VITE_HCAPTCHA_SITE_KEY – hCaptcha disabled');
}
```

#### 1.3 Update SessionContext (`src/contexts/SessionContext.tsx`)

**Modify `initializeSession`:**
```typescript
const initializeSession = useCallback(async (captchaToken?: string) => {
  if (isCreatingSession.current) {
    console.log('[Session] Creation already in progress, skipping...');
    return;
  }

  try {
    setLoading(true);
    isCreatingSession.current = true;

    const { data: { session: authSession } } = await supabase.auth.getSession();
    if (!authSession) {
      await ensureAnonAuth();
    }

    await createNewSession(captchaToken);
  } catch (error) {
    console.error('[Session] Error in initializeSession:', error);
    toast.error(ERROR_MESSAGES.SESSION_CREATE_ERROR);
    throw error;
  } finally {
    setLoading(false);
    isCreatingSession.current = false;
  }
}, [ensureAnonAuth, createNewSession]);
```

**Modify `createNewSession`:**
```typescript
const createNewSession = useCallback(async (captchaToken?: string) => {
  const generationId = ++sessionGenerationCounter.current;
  console.log('[Session] Creating new session, generation:', generationId);

  try {
    const { data: { session: authSession }, error: sessionError } = 
      await supabase.auth.getSession();

    if (sessionError || !authSession) {
      throw new Error('No valid auth session');
    }

    const { data, error } = await supabase.functions.invoke('create-guest-session', {
      body: { 
        is_test: false,
        captcha_token: captchaToken 
      },
    });

    if (error) throw error;

    if (generationId === sessionGenerationCounter.current) {
      setSession(data);
      localStorage.setItem('session', JSON.stringify(data));
      console.log('[Session] Session created successfully');
    } else {
      console.log('[Session] Discarding stale session (generation mismatch)');
    }
  } catch (error) {
    console.error('[Session] Error creating session:', error);
    throw error;
  }
}, []);
```

### Phase 2: Backend Integration

#### 2.1 Update Edge Function (`supabase/functions/create-guest-session/index.ts`)

**Add hCaptcha Verification Function:**
```typescript
async function verifyHCaptcha(token: string): Promise<boolean> {
  const secretKey = Deno.env.get('HCAPTCHA_SECRET_KEY');
  
  if (!secretKey) {
    console.error('[hCaptcha] Missing HCAPTCHA_SECRET_KEY environment variable');
    return false;
  }

  try {
    const response = await fetch('https://hcaptcha.com/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `response=${token}&secret=${secretKey}`,
    });

    const data = await response.json();
    console.debug('[hCaptcha] Verification result:', { success: data.success });
    
    return data.success === true;
  } catch (error) {
    console.error('[hCaptcha] Verification error:', error);
    return false;
  }
}
```

**Update Main Handler:**
```typescript
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
  // Validate environment variables at cold start
  if (!Deno.env.get('HCAPTCHA_SECRET_KEY')) {
    console.error('Missing HCAPTCHA_SECRET_KEY environment variable');
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check for consent header
    const hasConsent = req.headers.get('x-consent-given') === 'true';
    if (!hasConsent) {
      console.warn('Session creation attempted without consent flag');
    }

    // Defense-in-depth: Verify Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('Missing or invalid Authorization header');
      return new Response(
        JSON.stringify({ 
          error: 'unauthorized',
          message: 'Unauthorized - invalid auth session' 
        }),
        { headers: securityHeaders, status: 401 }
      );
    }

    // Rate limiting
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    
    const rateLimitKey = `create-session:${clientIp}`;
    const rateLimit = checkRateLimit(rateLimitKey, 10, 3600000);

    if (!rateLimit.allowed) {
      console.log('Rate limit exceeded for IP:', clientIp);
      return new Response(
        JSON.stringify({
          error: 'rate_limit_exceeded',
          message: 'Too many session requests. Please try again later.',
          retry_after: rateLimit.retryAfter,
        }),
        {
          headers: {
            ...securityHeaders,
            'X-RateLimit-Reason': 'Too many session creation attempts'
          },
          status: 429,
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const accessToken = authHeader.replace(/^Bearer\s+/i, '');

    // Verify user with anon client
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const dbClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const { data: { user }, error: getUserError } = await authClient.auth.getUser(accessToken);
    
    if (getUserError || !user) {
      console.error('Auth verification failed:', getUserError);
      return new Response(
        JSON.stringify({ 
          error: 'unauthorized',
          message: 'Unauthorized - invalid auth session' 
        }),
        { headers: securityHeaders, status: 401 }
      );
    }

    console.log('Authenticated user:', user.id);

    // Parse request body
    const req_body = await req.json().catch(() => ({}));
    const isTest = req_body.is_test || false;
    const captchaToken = req_body.captcha_token;
    
    console.log('[Session] Creating guest session, is_test:', isTest);

    // Verify hCaptcha (skip in test mode)
    if (!isTest) {
      if (!captchaToken) {
        console.warn('[hCaptcha] No captcha token provided');
        return new Response(
          JSON.stringify({
            error: 'captcha_required',
            message: 'Human verification required'
          }),
          { headers: securityHeaders, status: 403 }
        );
      }

      const isValidCaptcha = await verifyHCaptcha(captchaToken);
      if (!isValidCaptcha) {
        console.warn('[hCaptcha] Verification failed for user:', user.id);
        return new Response(
          JSON.stringify({
            error: 'captcha_verification_failed',
            message: 'Human verification failed'
          }),
          { headers: securityHeaders, status: 403 }
        );
      }

      console.debug('[hCaptcha] Verification successful for user:', user.id);
    }

    const username = generateUsername();
    const avatar = generateAvatar();

    // Insert guest session
    const { data: session, error } = await dbClient
      .from('guest_sessions')
      .insert({
        username,
        avatar,
        user_id: user.id,
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
      captchaVerified: !isTest,
      timestamp: new Date().toISOString()
    });

    return new Response(
      JSON.stringify(session),
      {
        headers: securityHeaders,
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error creating guest session:', error);
    return new Response(
      JSON.stringify({ 
        error: 'session_creation_failed',
        message: 'Failed to create session. Please try again.' 
      }),
      {
        headers: securityHeaders,
        status: 500,
      }
    );
  }
});
```

### Phase 3: Error Handling

#### 3.1 Update Constants (`src/config/constants.ts`)

Add hCaptcha-specific error messages:

```typescript
export const ERROR_MESSAGES = {
  // ... existing messages
  CAPTCHA_REQUIRED: "Human verification required",
  CAPTCHA_FAILED: "Human verification failed - please try again",
  CAPTCHA_TIMEOUT: "Verification timeout - please try again",
  CAPTCHA_NETWORK_ERROR: "Connection issue during verification",
} as const;
```

### Phase 4: Testing Protocol

#### Test Scenarios

1. **Normal Flow (Happy Path)**
   - User completes age gate
   - Accepts ToS/PP
   - Clicks "Let's Get Started"
   - hCaptcha executes invisibly
   - Session created successfully
   - User redirected to Survey
   - **Expected**: No user-visible captcha, seamless flow

2. **Test Mode Bypass**
   - Set `is_test: true` in request body
   - Submit without captcha token
   - **Expected**: Session created, captcha skipped

3. **Failed Verification**
   - Simulate invalid captcha token
   - **Expected**: 403 error, user sees "Human verification failed" toast

4. **Token Expiry**
   - Wait 2+ minutes before submitting
   - **Expected**: "Token expired" error, user can retry

5. **Slow Verification (Timeout)**
   - Simulate network delay >10 seconds
   - **Expected**: "Verification timeout" error, cleanup triggered

6. **Invalid Token Replay**
   - Manually send POST with expired/fake token
   - **Expected**: 403 + structured error JSON

#### Testing Commands

```bash
# Test normal flow (manual testing)
# Navigate to / → complete age gate → observe console logs

# Test backend directly
curl -X POST https://[PROJECT_ID].supabase.co/functions/v1/create-guest-session \
  -H "Authorization: Bearer [ANON_KEY]" \
  -H "Content-Type: application/json" \
  -d '{"captcha_token": "fake_token", "is_test": false}'

# Expected: 403 with captcha_verification_failed

# Test with is_test flag
curl -X POST https://[PROJECT_ID].supabase.co/functions/v1/create-guest-session \
  -H "Authorization: Bearer [ANON_KEY]" \
  -H "Content-Type: application/json" \
  -d '{"is_test": true}'

# Expected: 200 with session data
```

### Phase 5: Monitoring & Observability

#### Metrics to Track

**Edge Function Logs:**
```typescript
// Add to edge function
console.log('[Metrics]', {
  event: 'captcha_verification',
  success: isValidCaptcha,
  userId: user.id,
  isTest: isTest,
  duration: Date.now() - startTime,
  timestamp: new Date().toISOString()
});
```

**Frontend Analytics:**
- `captcha_started`: When `execute()` called
- `captcha_success`: When token received
- `captcha_failure`: When verification fails
- `captcha_timeout`: When promise rejects

#### Log Queries (Supabase Dashboard)

```sql
-- Failed captcha attempts
SELECT * FROM edge_logs 
WHERE msg LIKE '%captcha%failed%' 
ORDER BY timestamp DESC 
LIMIT 100;

-- Rate limit hits
SELECT * FROM edge_logs 
WHERE msg LIKE '%Rate limit exceeded%' 
ORDER BY timestamp DESC 
LIMIT 100;
```

### Phase 6: Security Considerations

#### Defense-in-Depth Measures Implemented

1. **Token Replay Prevention**
   - Optional: Add Redis/KV cache to track used tokens
   - TTL: 2 minutes (matches hCaptcha token expiry)

2. **Rate Limiting**
   - 10 session creations per IP per hour
   - X-RateLimit-Reason header for observability

3. **Authorization Validation**
   - Explicit Bearer token check
   - Supabase auth verification before captcha check

4. **Error Handling**
   - Structured JSON responses
   - No sensitive data leakage in error messages
   - Debug logs instead of console.log

5. **Environment Variable Validation**
   - Cold start check for HCAPTCHA_SECRET_KEY
   - Build-time check for VITE_HCAPTCHA_SITE_KEY

#### Optional: Score-Based Filtering

hCaptcha Enterprise supports risk scores. To implement:

```typescript
// In verifyHCaptcha function
const data = await response.json();
const score = data.score; // 0.0 (bot) to 1.0 (human)

if (score < 0.5) {
  console.warn('[hCaptcha] Low score:', score);
  return false;
}
```

### Phase 7: Rollback Plan

If issues arise post-deployment:

1. **Immediate**: Set `is_test: true` globally in frontend
2. **Short-term**: Add feature flag to disable captcha
3. **Monitoring**: Watch for increased bounce rates at age gate

### Environment Variables Required

```env
# Frontend (.env)
VITE_HCAPTCHA_SITE_KEY=your_site_key_here

# Backend (Supabase Secrets)
HCAPTCHA_SECRET_KEY=your_secret_key_here
```

### Files to Modify

1. `package.json` (add @hcaptcha/react-hcaptcha)
2. `src/components/AgeGate.tsx` (primary integration)
3. `src/contexts/SessionContext.tsx` (pass token to backend)
4. `supabase/functions/create-guest-session/index.ts` (verify token)
5. `src/config/constants.ts` (error messages)
6. `.env` (add VITE_HCAPTCHA_SITE_KEY)

### Implementation Checklist

- [ ] Install @hcaptcha/react-hcaptcha
- [ ] Add VITE_HCAPTCHA_SITE_KEY to .env
- [ ] Add HCAPTCHA_SECRET_KEY to Supabase secrets
- [ ] Update AgeGate.tsx with promise-based captcha
- [ ] Update SessionContext.tsx to pass token
- [ ] Update edge function with verification logic
- [ ] Add error messages to constants.ts
- [ ] Test all 6 scenarios
- [ ] Monitor logs for 24 hours post-deployment
- [ ] Document metrics baseline

### Success Criteria

✅ Bot traffic reduced by >80%  
✅ No increase in legitimate user friction  
✅ <100ms added latency for captcha execution  
✅ <0.1% false positive rate  
✅ Zero production errors related to captcha  

### Estimated Timeline

- **Implementation**: 2-3 hours
- **Testing**: 1-2 hours
- **Monitoring**: 24 hours post-deployment
- **Total**: 1 business day

---

## References

- [hCaptcha React Documentation](https://docs.hcaptcha.com/libraries/react)
- [hCaptcha Verification API](https://docs.hcaptcha.com/verification)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Rate Limiting Best Practices](https://cloud.google.com/architecture/rate-limiting-strategies-techniques)

---

**Document Version**: 1.0  
**Last Updated**: 2025-10-10  
**Status**: Ready for Implementation
