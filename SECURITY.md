# Security Architecture - Conversely

## Overview
Conversely uses a **guest session architecture** with a hybrid security model:
- **Edge Functions** enforce authorization (session validation, rate limiting, content filtering)
- **RLS Policies** provide defense-in-depth and prevent unauthorized writes
- **Input Validation** happens both client-side (UX) and server-side (security)

## Completed Security Phases

### ✅ Phase 1: Content Validation & Rate Limiting
- Blocked inappropriate content patterns (profanity, PII, URLs, HTML/XSS)
- Rate limiting on all critical endpoints:
  - Session creation: 5/hour per IP
  - Matching: 20/5min per session
  - Messages: 30/min per session
  - Blocking: 10/hour per session
  - Reflections: 5/hour per session
  - End chat: 10/hour per session
- Request size limits (1KB max)

### ✅ Phase 2-7: RLS Policies (Fixed)
- **guest_sessions**: Only visible to active chat partners
- **survey_answers**: Only visible to matched partners in active rooms
- **messages**: Only readable in active rooms, can only insert to active rooms
- **chat_rooms**: Read-only for clients (updates blocked), edge functions handle changes
- **blocked_pairs**: Readable (required for matching algorithm)
- **reflections**: Write-only (no SELECT policy)

### ✅ Phase 5: Input Validation Enhancement
- Enhanced pattern detection (spam, emojis, zero-width chars, HTML tags)
- Centralized UUID validation
- Username validation with reserved names
- Request body structure validation
- Content sanitization utilities
- Error codes for better debugging (CV_*)

### ✅ Phase 6: Frontend Validation
- Chat message validation with character counter (500 max)
- Reflection feedback validation (10-1000 chars)
- Real-time content checks before sending
- User-friendly error messages

## Security Model Trade-offs

### Guest Session Architecture Limitations
Without traditional authentication (`auth.uid()`), we cannot:
1. ❌ Restrict `chat_rooms` SELECT to only participants
2. ❌ Prevent users from seeing all active session usernames/avatars
3. ❌ Hide the existence of active chat rooms

### Why These Are Acceptable
1. **Privacy by Design**: Messages auto-delete after 60 seconds
2. **Minimal Data**: Only username/avatar exposed (no email, real name, etc.)
3. **Edge Function Protection**: All writes validated by server-side code
4. **No Authentication State**: Users can't be tracked across sessions

### Alternative: Anonymous Auth
If stricter privacy is needed, implement Supabase Anonymous Auth:
```sql
-- Link guest_sessions to auth.users
ALTER TABLE guest_sessions ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- Then use auth.uid() in RLS policies
CREATE POLICY "Users see own session"
  ON guest_sessions FOR SELECT
  USING (user_id = auth.uid());
```

## Security Checklist

### ✅ Completed
- [x] Input validation (client + server)
- [x] Rate limiting on all endpoints
- [x] Content filtering (profanity, PII, XSS)
- [x] RLS policies with defense-in-depth
- [x] Request size limits
- [x] Error code standardization
- [x] Blocked unauthorized room updates
- [x] Message/feedback length limits
- [x] HTML/script tag detection

### ⚠️ Known Limitations (By Design)
- [ ] chat_rooms visible to all (required for realtime)
- [ ] Guest sessions visible to active room users
- [ ] blocked_pairs readable (required for matching)

### 🔄 Future Enhancements
- [ ] Implement anonymous authentication
- [ ] Add IP geolocation blocking
- [ ] Enhanced spam detection (ML-based)
- [ ] Automated abuse reporting
- [ ] Session fingerprinting

## Monitoring & Maintenance

### Regular Tasks
1. **Review Edge Function Logs**: Check for abuse patterns
2. **Monitor Rate Limits**: Adjust thresholds if needed
3. **Update Blocked Patterns**: Add new inappropriate content patterns
4. **Audit RLS Policies**: Ensure no policy drift

### Incident Response
1. **Suspected Abuse**: Check edge function logs for session_id
2. **Block Pairs**: Add to `blocked_pairs` table manually if needed
3. **Rate Limit Bypass**: Review and tighten limits
4. **Content Bypass**: Update `BLOCKED_PATTERNS` in validation.ts

## Testing

### Security Test Scenarios
```bash
# Test rate limiting
for i in {1..10}; do curl -X POST <endpoint>; done

# Test blocked content
curl -X POST <endpoint> -d '{"content":"test@email.com"}'

# Test SQL injection
curl -X POST <endpoint> -d '{"content":"'; DROP TABLE--"}'

# Test XSS
curl -X POST <endpoint> -d '{"content":"<script>alert(1)</script>"}'
```

### Expected Results
- Rate limits trigger 429 errors
- Blocked content returns validation errors
- SQL injection/XSS blocked by validation
- All writes require valid session_id

## Contact
For security concerns, review edge function logs and blocked_pairs table for abuse patterns.
