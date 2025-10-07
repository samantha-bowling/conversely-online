# Security Architecture - Conversely

## Overview
Conversely uses **Supabase Anonymous Authentication** with a defense-in-depth security model:
- **Anonymous Auth** provides proper `auth.uid()` for RLS policies without requiring user signup
- **Edge Functions** enforce business logic (matching, content validation, rate limiting)
- **RLS Policies** provide database-level access control with explicit DENY policies
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

### ✅ Phase 2-4: RLS Policies with auth.uid()
- **guest_sessions**: Users can only view/update their own session
- **survey_answers**: Users can only view their own answers, read partner answers in active rooms
- **messages**: Users can only read messages in rooms they're part of, insert to their active rooms
- **chat_rooms**: Users can only read rooms they're a participant in
- **blocked_pairs**: Users can only read pairs involving themselves
- **reflections**: Write-only (users can only insert their own reflections)

### ✅ Phase 5: Explicit DENY Policies
- Added explicit `USING (false)` policies for all UPDATE/DELETE operations
- Ensures all mutations go through Edge Functions with service role
- Prevents any client-side data manipulation at database level
- Applied to: guest_sessions, survey_answers, messages, blocked_pairs, chat_rooms

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

## Security Model

### Anonymous Authentication Benefits
Using Supabase Anonymous Auth provides:
1. ✅ Proper `auth.uid()` for RLS policies without user signup
2. ✅ Session-based access control at database level
3. ✅ Users can only access their own data and active room data
4. ✅ Prevents unauthorized reads across sessions
5. ✅ Standard Supabase auth patterns work out of the box

### Privacy by Design
1. **Ephemeral Data**: Messages auto-delete after 60 seconds, rooms after 2 minutes
2. **Minimal Collection**: Only username (random), avatar, survey answers, and temporary messages
3. **Anonymous Identity**: No email, phone, or real names collected
4. **Session Isolation**: Each anonymous session is independent with unique `auth.uid()`
5. **No Tracking**: Users can't be tracked across sessions

### Defense-in-Depth Layers
1. **Client-side validation**: Immediate user feedback, character limits
2. **Edge Functions**: Business logic, rate limiting, content filtering
3. **RLS Policies**: Database-level access control with `auth.uid()`
4. **Explicit DENY policies**: Prevent all client-side UPDATE/DELETE operations
5. **Auto-deletion**: Temporary data storage with automatic cleanup

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

### ⚠️ Acceptable Trade-offs (By Design)
- [x] chat_rooms visible to participants only (RLS enforced)
- [x] Guest sessions visible only to owner and active room partner
- [x] blocked_pairs readable only to involved users (required for matching)

### 🔄 Future Enhancements
- [ ] Add IP geolocation blocking for compliance
- [ ] Enhanced spam detection (ML-based pattern recognition)
- [ ] Automated abuse reporting with threshold triggers
- [ ] Session fingerprinting for advanced bot detection
- [ ] Content moderation dashboard for manual review

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
