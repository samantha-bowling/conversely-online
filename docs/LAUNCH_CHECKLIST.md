# Launch Checklist

**Last Updated:** 2025-10-15  
**Status:** Pre-Launch Verification  
**Estimated Time:** 4-6 hours total

This document provides a comprehensive checklist to verify Conversely is ready for production launch and establish post-launch monitoring procedures.

---

## Pre-Launch Verification

### A. Manual Functional Testing (2-3 hours)

#### 1. Matching Flow Test
**Goal:** Verify users can match with opposite viewpoints

**Steps:**
1. Open two private browser windows (Chrome Incognito + Firefox Private)
2. Navigate to `/` in both windows
3. Fill out survey with **opposite stances** on at least 2 questions
4. Complete surveys and click "Find My Match"
5. Verify both users reach the matching page
6. Verify successful match within 10 seconds

**Expected Results:**
- ✅ Both users matched together
- ✅ Redirected to `/chat/:roomId` with same room ID
- ✅ No console errors

**Red Flags:**
- ❌ Users stuck on "Searching..." for >30 seconds
- ❌ Matched with same user in multiple tests
- ❌ Console errors mentioning `match-opposite` or rate limits

---

#### 2. Real-Time Messaging Test
**Goal:** Verify message sending, receiving, and content filtering

**Steps:**
1. Using matched session from Test #1
2. Browser A: Send "Hello, nice to meet you!"
3. Browser B: Verify message appears within 2 seconds
4. Browser B: Send reply "Hi! Excited to chat."
5. Browser A: Verify reply appears
6. Browser A: Attempt to send email: "My email is test@example.com"
7. Browser A: Attempt to send URL: "Check out https://example.com"
8. Browser A: Attempt to send profanity (test content filter)

**Expected Results:**
- ✅ Normal messages appear instantly (<2s)
- ✅ Typing indicators work (optional if implemented)
- ✅ Email blocked with toast: "Messages containing personal info are not allowed"
- ✅ URL blocked with toast
- ✅ Profanity blocked or flagged

**Red Flags:**
- ❌ Messages delayed >5 seconds
- ❌ PII/URLs not blocked (critical security issue)
- ❌ Messages arrive out of order

---

#### 3. Disconnect Detection Test
**Goal:** Verify partner disconnect notification works within 30 seconds

**Steps:**
1. Continue using matched session from Test #1
2. Browser A: Send a message to confirm connection
3. Browser B: **Close the tab/window completely**
4. Browser A: Wait and observe for disconnect banner
5. Start timer: Should appear within 30 seconds

**Expected Results:**
- ✅ Disconnect banner appears within 30 seconds
- ✅ Banner says "Your partner has disconnected"
- ✅ Chat input is disabled
- ✅ "End Chat" button still works

**Red Flags:**
- ❌ No disconnect notification after 60 seconds
- ❌ User can still send messages to disconnected partner
- ❌ Console errors about heartbeat or presence

---

#### 4. Session Expiry Test
**Goal:** Verify 24-hour session timeout enforces correctly

**Steps:**
1. Create a new guest session (complete survey + match)
2. Open browser DevTools → Application → Local Storage
3. Find `guest_session` key
4. Modify `expires_at` to a past timestamp (e.g., 1 hour ago)
5. Refresh the page
6. Verify redirect to `/session-expired`

**Expected Results:**
- ✅ Redirected to session expired page within 5 seconds
- ✅ `guest_session` cleared from localStorage
- ✅ "Return to Home" button works

**Red Flags:**
- ❌ User remains in chat after session expired
- ❌ No redirect to `/session-expired`
- ❌ Console errors about `useSessionExpiry`

---

#### 5. Block User Test
**Goal:** Verify blocked users cannot rematch

**Steps:**
1. Complete Test #1 to establish a matched chat
2. Browser A: Click "Block and End Chat"
3. Verify confirmation dialog appears
4. Confirm block action
5. Browser A: Navigate back to `/` and fill out **identical survey answers**
6. Trigger matching again
7. Browser B: Also navigate back and attempt to match with **identical survey answers**

**Expected Results:**
- ✅ Browser A does NOT match with Browser B again
- ✅ May wait longer or get "no match found"
- ✅ Console shows no errors about `blocked_pairs` table

**Red Flags:**
- ❌ Matched with previously blocked user
- ❌ Error inserting into `blocked_pairs` table
- ❌ Block action doesn't save to database

---

#### 6. Network Resilience Test
**Goal:** Verify offline/online detection and reconnection logic

**Steps:**
1. Start a matched chat session
2. Browser A: Open DevTools → Network Tab
3. Toggle "Offline" mode
4. Observe UI for offline banner (should appear within 3-5 seconds)
5. Toggle back to "Online"
6. Verify reconnection banner appears
7. Send a test message to confirm realtime still works

**Expected Results:**
- ✅ Offline banner appears quickly (<5s)
- ✅ Online banner appears after reconnection
- ✅ Messages send successfully after reconnection
- ✅ No duplicate messages or missing messages

**Red Flags:**
- ❌ No offline/online indicators
- ❌ Messages fail to send after reconnection
- ❌ Console errors about channel subscriptions
- ❌ Infinite reconnection loops

---

### B. Backend Verification (30 minutes)

#### 1. Verify Maintenance Logs Infrastructure
**Goal:** Confirm `maintenance_logs` table exists and is being populated

**SQL Query:**
```sql
SELECT 
  id,
  function_name,
  execution_time,
  rooms_affected,
  error_message,
  created_at
FROM maintenance_logs
ORDER BY created_at DESC
LIMIT 10;
```

**Expected Results:**
- ✅ Table exists (no "relation does not exist" error)
- ✅ Recent entries within last 10 minutes
- ✅ `function_name = 'close_inactive_rooms'`
- ✅ `rooms_affected >= 0` (may be 0 if no stale rooms)
- ✅ `error_message IS NULL` (no errors during execution)

**Red Flags:**
- ❌ No entries in last hour
- ❌ `error_message` is populated (indicates job failure)
- ❌ Table does not exist (run migration)

---

#### 2. Manual Cleanup Job Trigger Test
**Goal:** Verify cleanup job can be manually invoked

**SQL Query:**
```sql
SELECT close_inactive_rooms();
```

**Expected Results:**
- ✅ Query executes without error
- ✅ Returns integer (number of rooms closed)
- ✅ New entry added to `maintenance_logs` immediately after execution

**Red Flags:**
- ❌ Function does not exist
- ❌ Execution hangs or times out
- ❌ No new log entry created

---

#### 3. Verify Cron Schedule Active
**Goal:** Confirm automated cleanup runs every 5 minutes

**SQL Query:**
```sql
SELECT 
  COUNT(*) as total_runs,
  MAX(created_at) as last_run,
  EXTRACT(EPOCH FROM (NOW() - MAX(created_at))) / 60 as minutes_since_last_run
FROM maintenance_logs
WHERE function_name = 'close_inactive_rooms'
  AND created_at > NOW() - INTERVAL '1 hour';
```

**Expected Results:**
- ✅ `total_runs >= 12` (should run ~12 times per hour)
- ✅ `minutes_since_last_run < 10` (last run within 10 minutes)
- ✅ Regular cadence visible when ordering by `created_at`

**Red Flags:**
- ❌ `total_runs = 0` (cron not running)
- ❌ `minutes_since_last_run > 15` (job stopped recently)
- ❌ Large gaps in execution times (intermittent failures)

---

#### 4. Verify Safety Clamps Not Triggering
**Goal:** Ensure high-volume protection logic is not engaged unnecessarily

**SQL Query:**
```sql
SELECT 
  created_at,
  rooms_affected,
  error_message
FROM maintenance_logs
WHERE function_name = 'close_inactive_rooms'
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 20;
```

**Expected Results:**
- ✅ `rooms_affected` typically between 0-10 (normal operation)
- ✅ `error_message IS NULL` for all entries
- ✅ No patterns of exactly 0 rooms closed repeatedly (indicates bug)

**Red Flags:**
- ❌ `rooms_affected` consistently 0 despite active users (job not working)
- ❌ `rooms_affected > 100` (possible mass disconnect event)
- ❌ `error_message` mentions "safety clamp" (needs investigation)

---

### C. Security Verification (1 hour)

#### 1. Attempt Client-Side Room Creation (Should Fail)
**Goal:** Verify RLS policies prevent direct room creation from client

**Steps:**
1. Open browser DevTools → Console
2. Paste the following code:
```javascript
const { data, error } = await supabase
  .from('chat_rooms')
  .insert({
    user1_id: crypto.randomUUID(),
    user2_id: crypto.randomUUID(),
    status: 'active'
  });
console.log('Result:', { data, error });
```
3. Execute the code

**Expected Results:**
- ✅ `error.code = '42501'` (insufficient privilege)
- ✅ `error.message` mentions "new row violates row-level security policy"
- ✅ `data = null`

**Red Flags:**
- ❌ `error = null` and `data` contains inserted row (CRITICAL SECURITY ISSUE)
- ❌ Room appears in database after test
- ❌ No RLS policy error thrown

**Remediation:** If test fails, immediately run migration from `VERIFICATION_LOG.md` Phase 1

---

#### 2. Attempt Direct Session Update (Should Fail)
**Goal:** Verify users cannot modify other users' session data

**Steps:**
1. Browser DevTools → Console
2. Paste the following code:
```javascript
const { data, error } = await supabase
  .from('guest_sessions')
  .update({ is_searching: true })
  .eq('user_id', 'some-random-uuid-here');
console.log('Result:', { data, error });
```
3. Execute the code

**Expected Results:**
- ✅ `error` exists OR `data = []` (no rows updated)
- ✅ Cannot modify sessions belonging to other users

**Red Flags:**
- ❌ Successfully updates another user's session
- ❌ No RLS policy preventing cross-user updates

---

#### 3. Rate Limit Test: Matching
**Goal:** Verify rate limits prevent abuse of matching endpoint

**Steps:**
1. Open browser DevTools → Console
2. Create rapid-fire matching requests:
```javascript
for (let i = 0; i < 20; i++) {
  supabase.functions.invoke('match-opposite', {
    body: { oppositeStances: { climate_change: 'deny' } }
  }).then(r => console.log(`Request ${i}:`, r.status));
}
```
3. Observe responses

**Expected Results:**
- ✅ First few requests succeed (200/404 status)
- ✅ Later requests return 429 (Too Many Requests)
- ✅ Error message mentions "Rate limit exceeded"

**Red Flags:**
- ❌ All 20 requests succeed (rate limiting not working)
- ❌ No 429 responses after 10+ rapid requests
- ❌ Server errors (500) instead of rate limit errors

---

#### 4. Content Blocking Test: PII Detection
**Goal:** Verify message validation blocks emails, phones, URLs

**Test Cases:**
| Input | Expected Result |
|-------|----------------|
| `"My email is john@example.com"` | Blocked |
| `"Call me at 555-1234"` | Blocked |
| `"Visit https://example.com"` | Blocked |
| `"I live at 123 Main St, Anytown USA 12345"` | Blocked (address) |
| `"My Instagram is @username"` | Blocked (social handle) |
| `"Normal conversation text"` | Allowed |

**Steps:**
1. During an active chat, attempt to send each test case
2. Verify toast notification appears for blocked messages
3. Verify allowed messages send successfully

**Expected Results:**
- ✅ All PII/contact info blocked
- ✅ Toast message explains why message was blocked
- ✅ Normal messages send without issues

**Red Flags:**
- ❌ Any PII slips through (CRITICAL - privacy violation)
- ❌ False positives (normal text incorrectly blocked)
- ❌ No user feedback when message blocked

---

## Post-Launch Monitoring

### Daily Checks (5 minutes)

#### 1. Check Maintenance Logs for Anomalies
```sql
SELECT 
  created_at,
  rooms_affected,
  execution_time,
  error_message
FROM maintenance_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
  AND (error_message IS NOT NULL OR rooms_affected > 50)
ORDER BY created_at DESC;
```

**What to look for:**
- Any rows with `error_message` populated → investigate immediately
- Sudden spike in `rooms_affected` (>50) → possible mass disconnect event
- No entries in last 24 hours → cron job stopped

---

#### 2. Review Edge Function Error Rates
**Access:** Lovable Backend → Functions → Logs

**Check each critical function:**
- `create-guest-session`
- `match-opposite`
- `send-message`
- `end-chat`
- `validate-session`

**Red Flags:**
- Error rate >5% for any function
- Sudden spike in 500 errors
- Repeated rate limit 429 errors (might indicate abuse or misconfiguration)

---

### Weekly Checks (30 minutes)

#### 1. Run Manual Health Queries
Execute all queries from `docs/MONITORING_QUERIES.md`:
- Overall system health (Query 1-3)
- Matching system health (Query 4-6)
- Message flow health
- Session expiry distribution
- Heartbeat health

**Compare against baselines established in first week**

---

#### 2. Review Abuse Detection Patterns
```sql
-- Serial blockers (users blocking many partners)
SELECT 
  blocker_id,
  COUNT(DISTINCT blocked_id) as blocked_count,
  MAX(blocked_at) as last_block
FROM blocked_pairs
WHERE blocked_at > NOW() - INTERVAL '7 days'
GROUP BY blocker_id
HAVING COUNT(DISTINCT blocked_id) >= 5
ORDER BY blocked_count DESC;
```

**Action Items:**
- Investigate users with >10 blocks in 7 days
- Check for harassment patterns (blocked by many users)

---

### Monthly Checks (1 hour)

#### 1. Update Disaster Recovery Docs
- Review `docs/ROLLBACK.md` for accuracy
- Update `docs/BACKUP_STRATEGY.md` if retention policies change
- Add new queries to `docs/MONITORING_QUERIES.md` based on observed issues
- Update `docs/INCIDENT_RESPONSE.md` with lessons learned

---

#### 2. Quarterly Disaster Recovery Drill
- Simulate an incident (e.g., "Matching system is down")
- Follow `docs/INCIDENT_RESPONSE.md` workflow
- Test rollback procedures from `docs/ROLLBACK.md`
- Document gaps in procedures
- Update docs based on drill findings

---

## Incident Response Quick Reference

**If something goes wrong during/after launch:**

1. **Identify severity** using `docs/INCIDENT_RESPONSE.md` levels
2. **P0/P1 incidents:** Immediately consult `docs/ROLLBACK.md`
3. **Gather data:** Run relevant queries from `docs/MONITORING_QUERIES.md`
4. **Create incident log:** `docs/incidents/YYYY-MM-DD-incident-name.md`
5. **Execute mitigation:** Follow INCIDENT_RESPONSE.md workflow
6. **Post-mortem:** Document within 48 hours

**Emergency Contacts:**
- Lovable Support: https://lovable.dev/support
- Supabase Project: `rlsontubfdpqzhoqezks`

---

## Sign-Off Checklist

Before marking launch-ready, confirm all items below:

### Functional Testing
- [ ] Matching flow works (Test A1)
- [ ] Real-time messaging works (Test A2)
- [ ] Disconnect detection works within 30s (Test A3)
- [ ] Session expiry enforced at 24 hours (Test A4)
- [ ] Block user prevents rematching (Test A5)
- [ ] Network resilience handles offline/online (Test A6)

### Backend Verification
- [ ] Maintenance logs table populated (Test B1)
- [ ] Cleanup job manually triggers (Test B2)
- [ ] Cron schedule running every 5 min (Test B3)
- [ ] Safety clamps not engaged (Test B4)

### Security Verification
- [ ] Client-side room creation blocked (Test C1)
- [ ] Session updates cross-user blocked (Test C2)
- [ ] Rate limits enforce on matching (Test C3)
- [ ] Content blocking catches all PII (Test C4)

### Documentation
- [ ] All disaster recovery docs created
- [ ] Post-launch monitoring calendar set
- [ ] Team trained on incident response workflow

**Launch Approved By:** ___________________  
**Date:** ___________________  
**Notes:** ___________________
