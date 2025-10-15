# Emergency Rollback Procedures

**Last Updated:** 2025-10-15  
**Project:** Conversely  
**Supabase Project ID:** `rlsontubfdpqzhoqezks`

---

## Quick Reference

| Scenario | Time to Execute | Recovery Window | Risk Level |
|----------|----------------|-----------------|------------|
| Code rollback | 2-5 minutes | Unlimited | Low |
| Database schema rollback | 15-30 minutes | 7 days | Medium |
| Edge function rollback | 2-5 minutes | Unlimited | Low |
| Full system rollback | 30-60 minutes | 7 days | High |

**Emergency Contact:** Lovable Support (via backend dashboard or [support email])

---

## 1. Code Rollback (Frontend)

### When to Use
- New deployment introduced UI bugs
- Critical frontend errors in production
- User-facing functionality broken

### Procedure

**Step 1: Access Version History**
1. Open the Lovable project editor
2. Click the **History** icon (top of chat panel)
3. Review recent deployments with timestamps

**Step 2: Identify Target Version**
- Look for the last known good deployment
- Check deployment notes/messages for context
- Verify timestamp aligns with incident start

**Step 3: Execute Rollback**
1. Click the **"Restore"** button on the target version
2. Confirm the rollback action
3. Wait for automatic redeployment (~2-3 minutes)

**Step 4: Verify Rollback**
- Test critical user flows:
  - [ ] Landing page loads
  - [ ] Age gate accepts users
  - [ ] Session creation works
  - [ ] Matching system connects users
  - [ ] Chat messages send/receive
  - [ ] Chat ending works
- Check browser console for errors
- Verify network requests succeed (no 5xx errors)

**Rollback Complete:** Code is now at previous stable version.

---

## 2. Database Schema Rollback

### When to Use
- Database migration broke queries
- RLS policies preventing access
- Schema changes causing edge function failures

### ⚠️ Important Limitations
- **Only schema/configuration recoverable** (tables, policies, functions, triggers)
- **Ephemeral data NOT recoverable** (messages, sessions, chat rooms - by design)
- Recovery window: 7 days (Supabase automatic backups)

### Procedure

**Step 1: Contact Support**
Since direct PITR (Point-in-Time Recovery) requires service role access:
1. Open Lovable backend dashboard: `<lov-open-backend>View Backend</lov-open-backend>`
2. Navigate to **Support** section
3. Request PITR with details:
   ```
   Subject: Emergency PITR Request - Conversely (rlsontubfdpqzhoqezks)
   
   Target timestamp: [YYYY-MM-DD HH:MM:SS UTC]
   Reason: [Brief description of issue]
   Affected tables: [List tables if known]
   ```

**Step 2: Document Current State**
Before PITR is executed, capture current state for comparison:
```sql
-- Save this output before rollback
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';

SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE schemaname = 'public';
```

**Step 3: Support Executes PITR**
- Lovable support team will restore database to target timestamp
- Estimated time: 15-30 minutes depending on database size
- You'll be notified when complete

**Step 4: Verify Schema Restoration**
Run these queries via backend SQL editor:

```sql
-- 1. Check tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- Expected: guest_sessions, chat_rooms, messages, reflections, 
--           survey_answers, blocked_pairs, maintenance_logs

-- 2. Verify RLS policies restored
SELECT tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename;

-- 3. Check database functions
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public'
ORDER BY routine_name;

-- Expected: can_see_room, can_see_session, can_see_room_messages,
--           atomic_create_match_room, check_partner_heartbeat,
--           close_inactive_rooms, cleanup_expired_sessions, etc.
```

**Step 5: Test Critical Queries**
```sql
-- Test session creation path
SELECT id, username, expires_at 
FROM guest_sessions 
WHERE created_at > now() - interval '1 hour'
LIMIT 5;

-- Test room creation
SELECT id, status, session_a, session_b 
FROM chat_rooms 
WHERE created_at > now() - interval '1 hour'
LIMIT 5;
```

**Step 6: Redeploy Edge Functions** (if needed)
If edge functions reference old schema, see Section 3.

**Rollback Complete:** Database schema restored to target timestamp.

---

## 3. Edge Function Rollback

### When to Use
- Edge function deployment introduced bugs
- Rate limiting too aggressive/lenient
- Validation logic broken

### Procedure

**Step 1: Identify Broken Function**
Check edge function logs via backend dashboard:
1. Navigate to **Edge Functions** section
2. Filter by recent errors (last 1-4 hours)
3. Identify function name (e.g., `send-message`, `match-opposite`)

Common failure patterns:
- `Invalid JWT` → Auth logic broken
- `Rate limit exceeded` (mass reports) → Rate limit config wrong
- `Session not found` → Database query broken

**Step 2: Access Function Code History**
Since edge functions are in `supabase/functions/[name]/index.ts`:
1. Open Lovable editor
2. Navigate to affected function file
3. Click **History** for that file

**Step 3: Restore Previous Version**
1. Review code diff between current and previous version
2. Click **"Restore"** on last known good version
3. Automatic redeployment starts (~2-3 minutes)

**Step 4: Verify Function Works**
Test via backend dashboard or client app:

**Via Backend (SQL Editor):**
```sql
-- For send-message function
-- Create test data then invoke via client

-- For maintenance function  
SELECT job_name, closed_count, safety_clamp_triggered 
FROM maintenance_logs 
ORDER BY created_at DESC 
LIMIT 5;
```

**Via Client App:**
- Create guest session → Test `create-guest-session`
- Start matching → Test `match-opposite`
- Send message → Test `send-message`
- End chat → Test `end-chat`

**Step 5: Monitor for Recurrence**
Watch edge function logs for 15-30 minutes post-rollback.

**Rollback Complete:** Edge function restored to previous version.

---

## 4. Full System Rollback

### When to Use
- Multi-component failure (code + DB + functions)
- Major deployment went wrong across stack
- Cascading errors from schema + code mismatch

### Procedure

**This is the nuclear option. Follow order carefully.**

**Step 1: Stop Active User Impact (0-5 min)**
1. If possible, display maintenance message (update Landing page)
2. Document exact failure time and symptoms

**Step 2: Rollback Code First (5-10 min)**
- Follow **Section 1: Code Rollback**
- This stops new bad code from executing
- Verify frontend loads (even if backend broken)

**Step 3: Rollback Edge Functions (10-15 min)**
- Follow **Section 3: Edge Function Rollback**
- Restore all recently modified functions
- Check `supabase/functions/` directory for changes in last 24hr

**Step 4: Assess Database Impact (15-20 min)**
Run diagnostic queries:
```sql
-- Check for orphaned data
SELECT 
  (SELECT COUNT(*) FROM chat_rooms WHERE status = 'active') as active_rooms,
  (SELECT COUNT(*) FROM guest_sessions WHERE expires_at > now()) as active_sessions,
  (SELECT COUNT(*) FROM messages WHERE expires_at > now()) as active_messages;

-- Check maintenance jobs ran
SELECT job_name, created_at, closed_count, safety_clamp_triggered
FROM maintenance_logs
ORDER BY created_at DESC
LIMIT 10;
```

**Step 5: Database Schema Rollback (if needed) (20-50 min)**
- Only if diagnostic queries show schema corruption
- Follow **Section 2: Database Schema Rollback**
- Contact Lovable support for PITR

**Step 6: Comprehensive Verification (50-60 min)**
Test full user journey:
1. [ ] New user lands on site
2. [ ] Completes age gate
3. [ ] Creates session
4. [ ] Enters matching queue
5. [ ] Gets matched with partner
6. [ ] Sends/receives messages
7. [ ] Ends chat gracefully
8. [ ] Sees post-chat reflection

Check backend health:
```sql
-- Run all queries from docs/MONITORING_QUERIES.md
-- Compare against expected values
```

**Step 7: Monitor Stability (60-90 min)**
- Watch edge function error rates
- Check maintenance_logs for cleanup issues
- Monitor user reports

**Rollback Complete:** All systems restored to stable state.

---

## 5. Post-Rollback Verification Checklist

### Frontend Checks
- [ ] Landing page loads without errors
- [ ] Age gate accepts/rejects correctly
- [ ] Session creation succeeds
- [ ] Matching system queues users
- [ ] Chat UI renders properly
- [ ] Messages send in real-time
- [ ] Chat ending works
- [ ] Reflection dialog appears

### Backend Checks
- [ ] Edge function logs show no errors (15 min window)
- [ ] Database queries execute without timeout
- [ ] RLS policies allow expected access
- [ ] Maintenance jobs running (check `maintenance_logs`)
- [ ] Rate limiting blocks abuse attempts

### Performance Checks
- [ ] Message latency <500ms
- [ ] Matching time <30 seconds (average)
- [ ] Page load time <2 seconds
- [ ] No memory leaks (monitor for 1 hour)

---

## 6. Data Recovery Expectations

### ✅ Recoverable (within 7-day window)
- Database schema (tables, columns, constraints)
- RLS policies and database functions
- Edge function code
- Frontend application code
- Configuration files (`config.toml`, `constants.ts`)

### ❌ Not Recoverable (by design - privacy compliance)
- **Messages:** Expire after 2 minutes
- **Active chat sessions:** Ephemeral, 24-hour max lifetime
- **Chat rooms:** Closed rooms deleted by maintenance
- **Session data:** Deleted 24 hours after expiry

### ⚠️ Partially Recoverable (time-dependent)
- **Reflections:** If within 24-hour session window
- **Survey answers:** If within 24-hour session window
- **Blocked pairs:** If within active session lifetime
- **Maintenance logs:** 90-day retention (older logs auto-deleted)

**Alignment with Privacy Policy:**  
See `public/legal/data-retention.md` for legal compliance reasoning.

---

## 7. Common Rollback Scenarios

### Scenario A: "Matching system stuck"
**Symptoms:** Users stuck in matching queue, no matches created  
**Likely Cause:** `match-opposite` function broken or heartbeats failing  
**Rollback Steps:**
1. Check `match-opposite` edge function logs
2. Verify heartbeat updates: `SELECT last_heartbeat_at FROM guest_sessions LIMIT 10`
3. Rollback `match-opposite` function (Section 3)
4. If persists, run manual cleanup: `SELECT close_inactive_rooms()`

---

### Scenario B: "Messages not sending"
**Symptoms:** Chat input works but messages don't appear  
**Likely Cause:** `send-message` function broken or rate limiting  
**Rollback Steps:**
1. Check `send-message` edge function logs for rate limit hits
2. Verify RLS policy allows message insert: `SELECT * FROM pg_policies WHERE tablename = 'messages'`
3. Rollback `send-message` function (Section 3)
4. Test with fresh session to confirm

---

### Scenario C: "Users can't create sessions"
**Symptoms:** Age gate passes but session creation fails  
**Likely Cause:** `create-guest-session` function or `guest_sessions` RLS  
**Rollback Steps:**
1. Check `create-guest-session` edge function logs
2. Verify table exists: `SELECT * FROM guest_sessions LIMIT 1`
3. Check RLS: `SELECT policyname FROM pg_policies WHERE tablename = 'guest_sessions'`
4. Rollback function (Section 3) or database schema (Section 2)

---

### Scenario D: "High error rate across all functions"
**Symptoms:** Multiple edge functions failing simultaneously  
**Likely Cause:** Database schema change broke queries  
**Rollback Steps:**
1. Full system rollback (Section 4)
2. Prioritize database schema PITR
3. Then rollback code + functions

---

## 8. When NOT to Rollback

### Data Loss is Acceptable (Privacy by Design)
- If issue only affects ephemeral data (messages <2 min old)
- If sessions will expire naturally within 24 hours
- If maintenance cleanup will resolve automatically

### Forward Fix is Faster
- Typo in edge function (fix + redeploy in <5 min)
- Minor UI bug (CSS tweak)
- Rate limit adjustment (config change)

### Rollback Would Cause More Harm
- If rollback target version also has known issues
- If current issue affects <5% of users
- If incident already resolved (users adapted)

**Decision Framework:**
1. Severity: How many users affected?
2. Duration: How long to fix forward vs rollback?
3. Data: Will rollback lose important data?
4. Risk: Could rollback introduce new issues?

---

## 9. Preventing Future Incidents

### Pre-Deployment Checklist
- [ ] Test migrations on staging data first
- [ ] Review RLS policy changes for access gaps
- [ ] Verify edge function logs locally before deploy
- [ ] Check rate limit configs match expected load
- [ ] Run schema validation: `npm run db:validate` (if available)

### Monitoring Recommendations
- Run `docs/MONITORING_QUERIES.md` queries daily
- Set up alerts for maintenance job failures
- Review `maintenance_logs` weekly for anomalies
- Track matching time metrics (should be <30s avg)

### Quarterly Disaster Recovery Drills
- Practice code rollback (dev environment)
- Simulate database PITR request
- Time full system rollback procedure
- Update this document with learnings

---

## 10. Incident Log Template

**After every rollback, document incident:**

```markdown
## Incident: [Short Title]
**Date:** YYYY-MM-DD  
**Severity:** P0/P1/P2/P3  
**Duration:** HH:MM start → HH:MM resolved  

### Timeline
- [HH:MM] Incident detected via [source]
- [HH:MM] Rollback initiated
- [HH:MM] Rollback completed
- [HH:MM] Verification passed

### Root Cause
[1-2 sentence explanation]

### Rollback Executed
- [ ] Code (Section 1)
- [ ] Database (Section 2)
- [ ] Edge Functions (Section 3)
- [ ] Full System (Section 4)

### Lessons Learned
- What worked well:
- What to improve:
- Action items: [Link to docs/incidents/YYYY-MM-DD-incident-name.md]
```

**Save to:** `docs/incidents/YYYY-MM-DD-incident-name.md`

---

## Appendix: Critical File Locations

| Component | File Path | Purpose |
|-----------|-----------|---------|
| Edge Functions | `supabase/functions/*/index.ts` | Backend logic |
| Database Config | `supabase/config.toml` | Supabase settings |
| Frontend Routes | `src/App.tsx` | Page routing |
| Session Context | `src/contexts/SessionContext.tsx` | Auth state |
| Matching Logic | `supabase/functions/match-opposite/index.ts` | Pairing algorithm |
| Maintenance Jobs | `supabase/functions/maintenance/index.ts` | Cleanup automation |
| Legal Docs | `public/legal/*.md` | Privacy/Terms |
| Constants | `src/config/constants.ts` | App-wide settings |

---

**Document Version:** 1.0  
**Review Schedule:** Quarterly or post-incident  
**Owner:** Engineering Team
