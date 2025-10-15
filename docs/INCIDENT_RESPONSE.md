# Incident Response Playbook

**Last Updated:** 2025-10-15  
**Project:** Conversely  
**Supabase Project ID:** `rlsontubfdpqzhoqezks`

---

## Purpose

This document provides a **standardized workflow** for handling production incidents, from detection to post-mortem. Following this process ensures consistent, efficient responses that minimize user impact.

**When to Use:** Any production issue affecting users or system stability.

---

## Severity Levels

| Level | Impact | Response Time | Examples |
|-------|--------|---------------|----------|
| **P0 - Critical** | Complete outage, privacy breach | Immediate | Site down, data exposed, auth broken |
| **P1 - High** | Partial degradation (>30% users affected) | <15 minutes | Matching stuck, messages not sending |
| **P2 - Medium** | Performance issues (<30% users affected) | <1 hour | Slow page loads, intermittent errors |
| **P3 - Low** | Cosmetic issues, minor bugs | <24 hours | UI glitches, typos, analytics issues |

**Escalation:** If severity unclear, default to **higher** level. Can always downgrade later.

---

## Incident Response Workflow

### Phase 1: Detection (0-5 minutes)

#### Detection Sources
1. **User Reports:** Messages in chat, social media, support email
2. **Monitoring Alerts:** Manual health checks (see `docs/MONITORING_QUERIES.md`)
3. **Error Logs:** Edge function logs, browser console errors
4. **Developer Observation:** Noticed during testing/usage

#### Initial Triage Questions
- [ ] What is the user-facing impact? (What can't users do?)
- [ ] How many users are affected? (All, most, some, few?)
- [ ] When did it start? (Timestamp of first report)
- [ ] Is it getting worse? (Spreading or contained?)

#### Immediate Actions
1. **Determine Severity** (P0/P1/P2/P3 using table above)
2. **Gather Initial Evidence:**
   - Screenshot of issue (if UI problem)
   - Copy error messages from browser console
   - Note timestamp of first occurrence
3. **Check Recent Changes:**
   - Review last 3 deployments in Lovable History
   - Check edge function recent modifications
   - Confirm if deployment correlates with incident start

**Output:** Incident severity determined, initial evidence collected.

---

### Phase 2: Incident Declaration (5-10 minutes)

#### For P0/P1 Only
Create incident log immediately to track timeline:

**Template:** `docs/incidents/YYYY-MM-DD-incident-short-title.md`

```markdown
# Incident: [Short Title]

**Severity:** P0 / P1 / P2 / P3  
**Status:** INVESTIGATING / MITIGATING / RESOLVED  
**Start Time:** YYYY-MM-DD HH:MM UTC  
**Resolution Time:** [TBD]  
**Duration:** [Calculated on resolution]

## Impact
- **User-Facing:** [What users cannot do]
- **Scope:** [% of users affected or specific features]
- **Data Loss:** [Yes/No - what data affected]

## Timeline
- **[HH:MM UTC]** - Incident detected via [source]
- **[HH:MM UTC]** - Severity confirmed as [P0/P1]
- **[HH:MM UTC]** - Investigation started
- **[HH:MM UTC]** - Root cause identified
- **[HH:MM UTC]** - Mitigation deployed
- **[HH:MM UTC]** - Verification completed
- **[HH:MM UTC]** - Incident resolved

## Root Cause
[To be filled during investigation]

## Resolution Steps
[To be filled during mitigation]

## Prevention Measures
[To be filled in post-mortem]

## Lessons Learned
[To be filled in post-mortem within 48 hours]
```

#### Communication (P0/P1 Only)
- **Internal:** Notify team in communication channel (if multi-person team)
- **External:** Consider status update if outage >15 minutes and user-facing

**For P2/P3:** No formal incident log required (can document in regular notes).

---

### Phase 3: Investigation (10-30 minutes)

#### Systematic Diagnosis

**Step 1: Check System Health (5 min)**
Run Quick Health Dashboard from `docs/MONITORING_QUERIES.md`:
```sql
-- Query 1: Overall System Health Snapshot
-- Record all values to incident log
```

**Red flags to look for:**
- 0 active sessions but active chats exist → Orphaned rooms
- 0 new matches in last hour during peak → Matching broken
- Recent messages = 0 but active chats > 10 → Message sending broken

---

**Step 2: Review Edge Function Logs (5-10 min)**
Access via Lovable backend:
<lov-actions>
  <lov-open-backend>View Backend</lov-open-backend>
</lov-actions>

**Functions to check (prioritized by incident type):**

| Symptom | Check These Functions | Look For |
|---------|----------------------|----------|
| Can't create session | `create-guest-session` | Auth errors, validation failures |
| Matching stuck | `match-opposite` | Rate limit hits, query timeouts |
| Messages not sending | `send-message` | Rate limit 429, validation errors |
| Chat won't end | `end-chat` | Database errors, RLS policy failures |
| Heartbeat issues | Client-side logs | Network errors, auth token expiry |

**Common Error Patterns:**
- `Invalid JWT` → Auth token expired or malformed
- `Rate limit exceeded` (many users) → Rate limit config too strict
- `Session not found` → Database query broken or session expired
- `RLS policy violation` → Permissions broken after migration

---

**Step 3: Check Maintenance Job Health (5 min)**
```sql
-- Query 3 from MONITORING_QUERIES.md
SELECT * FROM maintenance_logs ORDER BY created_at DESC LIMIT 10;
```

**Red flags:**
- No entries in last 15 minutes → Cron job not running
- `safety_clamp_triggered = true` → >100 stale rooms (investigate why)
- `would_close_count` very high → Heartbeat system broken

---

**Step 4: Compare to Recent Deployments (5 min)**
1. Open Lovable History
2. Find deployments within incident timeframe
3. Review changes in affected areas:
   - If matching broken → Check `match-opposite` function changes
   - If messages broken → Check `send-message` function + `messages` table RLS
   - If auth broken → Check `create-guest-session` function

**Correlation Check:**
- Incident started within 5 min of deployment? → **Very likely culprit**
- Incident started >1 hour after deployment? → Less likely (but possible under load)

---

**Step 5: Test Reproduction (5-10 min)**
Attempt to reproduce issue in controlled manner:

**For matching issues:**
1. Create 2 test sessions (different browsers/incognito)
2. Start matching on both
3. Observe if they connect within 30 seconds
4. Check edge function logs for `match-opposite` calls

**For message issues:**
1. Create test chat (2 sessions)
2. Send messages from both sides
3. Observe if messages appear (check realtime subscription)
4. Check `send-message` edge function logs

**For session creation:**
1. Open Landing page (incognito)
2. Complete age gate
3. Observe if session created and Survey page loads
4. Check `create-guest-session` logs

**Output:** Root cause hypothesis formed, supporting evidence collected.

---

### Phase 4: Mitigation (30-60 minutes)

#### Mitigation Decision Tree

**Is the root cause a recent deployment?**
- **YES** → Rollback appropriate component (see `docs/ROLLBACK.md`)
  - Code issue → Section 1: Code Rollback (5 min)
  - Database migration → Section 2: Database Rollback (30 min)
  - Edge function bug → Section 3: Edge Function Rollback (5 min)
  - Multi-component → Section 4: Full System Rollback (60 min)

- **NO** → Forward fix or manual intervention:

---

#### Common Mitigation Strategies

**Scenario A: Matching Stuck (users not getting matched)**

**Likely Cause:** Stale rooms blocking matching pool  
**Mitigation:**
1. Manually trigger cleanup:
   ```sql
   SELECT close_inactive_rooms();
   ```
2. Verify cleanup ran:
   ```sql
   SELECT * FROM maintenance_logs ORDER BY created_at DESC LIMIT 1;
   ```
3. Check if matching resumed:
   ```sql
   SELECT COUNT(*) FROM guest_sessions WHERE is_searching = true;
   -- Should decrease within 30 seconds as matches form
   ```

**If persists:** Rollback `match-opposite` edge function.

---

**Scenario B: Messages Not Sending**

**Likely Cause:** Rate limit too aggressive or `send-message` function broken  
**Mitigation:**

**If rate limit issue:**
1. Check current config in `supabase/functions/_shared/rate-limit-config.ts`
2. If rate limit triggered for many users → Forward fix:
   - Increase `max_requests` or `window_ms`
   - Redeploy edge function
   - Test with affected user (if available)

**If function bug:**
1. Rollback `send-message` function (Section 3 of ROLLBACK.md)
2. Verify messages sending in test chat

---

**Scenario C: Users Can't Create Sessions**

**Likely Cause:** `create-guest-session` function or RLS policy broken  
**Mitigation:**

**If function error in logs:**
1. Rollback `create-guest-session` function
2. Test session creation (incognito browser)

**If RLS policy error:**
1. Check RLS policies on `guest_sessions`:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'guest_sessions';
   ```
2. If policy broken → Database rollback (Section 2 of ROLLBACK.md)
3. Contact Lovable support for PITR

---

**Scenario D: High Error Rate Across Multiple Functions**

**Likely Cause:** Database schema change broke queries  
**Mitigation:**
1. Full system rollback (Section 4 of ROLLBACK.md)
2. Prioritize database PITR (contact Lovable support)
3. Rollback code + edge functions after DB restored

---

**Scenario E: Supabase/Lovable Cloud Infrastructure Issue**

**Signs:** All edge functions failing, database unresponsive, widespread timeouts  
**Mitigation:**
1. **No direct action available** (infrastructure-level issue)
2. Check Lovable/Supabase status pages (if available)
3. **Do not rollback** (won't help if infrastructure down)
4. Wait for service restoration
5. Communicate to users if extended outage (>30 min)

**Post-Restoration:**
- Verify system health with Query 1 (MONITORING_QUERIES.md)
- Check for data inconsistencies (orphaned rooms, etc.)
- Run maintenance cleanup manually if needed

---

#### Mitigation Execution Checklist

- [ ] Mitigation strategy selected (rollback or forward fix)
- [ ] Backup/snapshot taken (if forward fixing database)
- [ ] Mitigation executed (follow ROLLBACK.md procedures)
- [ ] Initial verification passed (issue appears resolved)
- [ ] Timeline updated in incident log

**Output:** Issue mitigated, initial verification complete.

---

### Phase 5: Verification (15-30 minutes)

#### Comprehensive Testing

**Do NOT close incident until these checks pass:**

**Test 1: Full User Journey (10 min)**
1. [ ] New user lands on site → Landing page loads without errors
2. [ ] Complete age gate → Accepted/rejected correctly
3. [ ] Session created → Survey page appears with username/avatar
4. [ ] Survey completed → Redirected to Matching page
5. [ ] Matching started → Paired with partner within 30 seconds
6. [ ] Chat opened → Chat UI renders, can see partner username
7. [ ] Messages exchanged → Both sides send/receive in real-time
8. [ ] Chat ended → Reflection dialog appears
9. [ ] Reflection submitted → Redirected to landing/thank you page

**Test 2: System Health Check (5 min)**
Re-run Quick Health Dashboard (Query 1 from MONITORING_QUERIES.md):
```sql
-- Compare values to pre-incident baseline
-- All metrics should be within expected ranges
```

**Test 3: Edge Function Log Review (5 min)**
- Check logs for affected functions (last 15 minutes)
- Verify no new errors or elevated error rate
- Confirm rate limiting back to normal

**Test 4: Maintenance Job Verification (5 min)**
```sql
-- Verify cleanup jobs running normally
SELECT * FROM maintenance_logs ORDER BY created_at DESC LIMIT 5;
```
- Should see new entries (cron runs every 5 min)
- `safety_clamp_triggered` should be `false`
- `closed_count` should be 0-10 (normal range)

**Test 5: Sustained Stability (10-15 min)**
- Monitor system for 10-15 minutes post-mitigation
- Watch for regression or new issues
- Check user reports (if communication channel exists)

**If any test fails:** Return to Phase 4 (Mitigation).

---

#### Success Criteria for Incident Closure

- [ ] All verification tests passed
- [ ] User-facing functionality fully restored
- [ ] No new errors in edge function logs (15 min window)
- [ ] System metrics back to baseline
- [ ] Root cause understood and documented
- [ ] Incident timeline complete in incident log

**Output:** Incident resolved, system stable.

---

### Phase 6: Post-Mortem (Within 48 Hours)

#### Post-Mortem Template

Update incident log (`docs/incidents/YYYY-MM-DD-incident-short-title.md`) with:

```markdown
## Root Cause Analysis

### What Happened
[Detailed technical explanation of what caused the incident]

**Example:**
> A database migration added a new column to `guest_sessions` table without a default value. 
> The `create-guest-session` edge function did not include this column in the INSERT statement, 
> causing all new session creations to fail with "NOT NULL constraint violation".

### Why It Happened
[Underlying reasons, not just surface-level cause]

**Example:**
> 1. Migration did not include a DEFAULT value for new column
> 2. Edge function code was not updated in same deployment
> 3. No staging environment to catch integration issues
> 4. Insufficient testing of session creation flow after migration

### Why Mitigation Took X Minutes
[Factors that delayed resolution]

**Example:**
> - Detection: 5 min (user report lag)
> - Investigation: 15 min (checked multiple functions before finding DB logs)
> - Mitigation: 30 min (required Lovable support for PITR, not instant)
> Total: 50 minutes

---

## Impact Assessment

### Users Affected
- **Total users during incident:** [X from query]
- **Users unable to create sessions:** [All new users]
- **Existing users affected:** [None - already had sessions]

### Data Loss
- **Messages lost:** [None - expired naturally during outage]
- **Sessions lost:** [None - database restored]
- **Permanent data loss:** [None]

### Reputation Impact
- **User reports:** [X complaints in chat/social media]
- **Negative feedback:** [Estimated % of affected users]

---

## What Went Well

- **Detection:** [e.g., User reported issue within 2 min of occurrence]
- **Communication:** [e.g., Team coordinated effectively on incident log]
- **Mitigation:** [e.g., Rollback procedure worked smoothly]
- **Documentation:** [e.g., ROLLBACK.md procedures were accurate]

---

## What Could Be Improved

1. **Prevention:** [e.g., Add schema validation checks before deployment]
2. **Detection:** [e.g., Implement automated health checks to detect faster]
3. **Mitigation:** [e.g., Request PITR access for faster database rollbacks]
4. **Testing:** [e.g., Add E2E tests for critical user journeys]

---

## Action Items

| Action | Owner | Deadline | Status |
|--------|-------|----------|--------|
| Add DEFAULT to new columns in future migrations | Engineer | Before next migration | ⬜ TODO |
| Create pre-deployment checklist (test session creation) | Engineer | Next week | ⬜ TODO |
| Set up automated daily health check queries | Engineer | Next sprint | ⬜ TODO |
| Document PITR request process with Lovable support | Engineer | This week | ⬜ TODO |

---

## Prevention Measures Implemented

- [ ] [Specific change made to prevent recurrence]
- [ ] [Process improvement documented]
- [ ] [Monitoring added to detect similar issues faster]

---

## Related Documentation Updates

- [ ] `docs/ROLLBACK.md` updated with new scenario (if novel situation)
- [ ] `docs/MONITORING_QUERIES.md` updated with new diagnostic query (if applicable)
- [ ] `docs/INCIDENT_RESPONSE.md` updated with lessons learned (if process improvement)

---

**Post-Mortem Completed By:** [Name]  
**Date:** YYYY-MM-DD  
**Reviewed By:** [Team/Stakeholder if applicable]
```

---

#### Post-Mortem Meeting (Optional)

**For P0/P1 incidents only:**
- Schedule within 48 hours of resolution
- Duration: 30-60 minutes
- Attendees: All involved in incident response
- Agenda:
  1. Walk through timeline (5-10 min)
  2. Discuss root cause (10-15 min)
  3. Review what went well (5-10 min)
  4. Brainstorm improvements (15-20 min)
  5. Assign action items (5-10 min)

**Blameless Culture:**
- Focus on systems and processes, not individuals
- Ask "why" 5 times to get to root cause
- Assume everyone acted with best intentions given info available

---

## Known Issues Playbook

### Issue: "Matching stuck"
**Symptoms:** Users in queue for >5 minutes, no matches forming  
**Quick Diagnosis:**
```sql
SELECT COUNT(*) FROM guest_sessions WHERE is_searching = true;
SELECT COUNT(*) FROM chat_rooms WHERE status = 'active' AND last_activity < now() - interval '5 minutes';
```
**Mitigation:**
1. Run `SELECT close_inactive_rooms();`
2. Check maintenance logs for safety clamp
3. If persists, rollback `match-opposite` function

**Root Cause:** Usually stale rooms blocking matching pool or heartbeat system broken.

---

### Issue: "Messages not sending"
**Symptoms:** Chat input works but messages don't appear, or intermittent failures  
**Quick Diagnosis:**
```sql
-- Check recent message activity
SELECT COUNT(*) FROM messages WHERE created_at > now() - interval '5 minutes';
-- Check edge function logs for rate limit 429 errors
```
**Mitigation:**
1. Check if rate limiting too strict (see `rate-limit-config.ts`)
2. Test with fresh session (rule out client-side caching)
3. Rollback `send-message` function if recent deployment

**Root Cause:** Rate limit config or message validation logic broken.

---

### Issue: "High rate limit hits"
**Symptoms:** Many users hitting rate limits, edge function returning 429 errors  
**Quick Diagnosis:**
- Review edge function logs for function with high 429 count
- Check if legitimate traffic spike or abuse

**Mitigation:**
1. **If abuse:** Identify session IDs hitting limits, consider blocking
2. **If legitimate:** Increase rate limit thresholds in `rate-limit-config.ts`
3. Redeploy affected edge function

**Root Cause:** Rate limits too conservative for actual usage or DDoS attempt.

---

### Issue: "Users can't create sessions"
**Symptoms:** Age gate passes but session creation fails, stuck on loading  
**Quick Diagnosis:**
```sql
-- Check if any sessions created recently
SELECT COUNT(*) FROM guest_sessions WHERE created_at > now() - interval '5 minutes';
-- Check edge function logs for create-guest-session errors
```
**Mitigation:**
1. Rollback `create-guest-session` function
2. If RLS policy error in logs → Database PITR needed
3. Test session creation after mitigation

**Root Cause:** Edge function bug or RLS policy blocking inserts.

---

### Issue: "Chat rooms not closing"
**Symptoms:** `active_chats` count growing indefinitely, maintenance job not cleaning up  
**Quick Diagnosis:**
```sql
SELECT * FROM maintenance_logs ORDER BY created_at DESC LIMIT 5;
SELECT COUNT(*) FROM chat_rooms WHERE status = 'active' AND last_activity < now() - interval '10 minutes';
```
**Mitigation:**
1. Check if maintenance cron running (look for logs in last 15 min)
2. Manually trigger: `SELECT close_inactive_rooms();`
3. If safety clamp triggered, investigate why so many stale rooms

**Root Cause:** Cron job stopped or heartbeat system broken (users not heartbeating).

---

### Issue: "Database queries timing out"
**Symptoms:** All edge functions slow, frequent timeouts in logs  
**Quick Diagnosis:**
- Check Lovable backend for database performance metrics
- Look for slow query logs (if available)

**Mitigation:**
1. **If specific table:** Check if missing indexes or table bloat
2. **If widespread:** Likely infrastructure issue (Supabase region problem)
3. Contact Lovable support if persists >15 minutes

**Root Cause:** Database overload (need indexes), Supabase infrastructure issue, or connection pool exhaustion.

---

## When NOT to Declare Incident

### Acceptable "Non-Incidents"
- **Single user reports issue that cannot be reproduced** → Likely client-side (browser cache, network)
- **Cosmetic bug affecting <5% of users** → P3, fix in normal workflow
- **Known limitation of ephemeral design** (e.g., "lost messages after 2 min") → By design, not a bug
- **Third-party service degradation** (Supabase outage) → No mitigation available, wait for restoration

### Gray Areas
- **Issue affecting only test/dev sessions** (`is_test = true`) → Fix but don't declare incident
- **Performance degradation during non-peak hours** → Monitor but may not need immediate response
- **User error** (e.g., confused about UI) → Improve UX but not an incident

---

## Incident Metrics (Track Monthly)

**Purpose:** Measure incident response effectiveness

| Metric | Definition | Target |
|--------|------------|--------|
| **MTTR** (Mean Time to Resolve) | Avg time from detection to resolution | <1 hour (P0/P1) |
| **MTTD** (Mean Time to Detect) | Avg time from incident start to detection | <5 minutes |
| **Incident Frequency** | # of P0/P1 incidents per month | <2 per month |
| **Repeat Incidents** | % of incidents that are regressions | <10% |
| **Post-Mortem Completion Rate** | % of P0/P1 incidents with completed post-mortem | 100% |

**Review quarterly to identify trends and improvement opportunities.**

---

## Emergency Contacts

**Lovable Support:**
- Access via backend dashboard: <lov-open-backend>View Backend</lov-open-backend>
- Use for: PITR requests, infrastructure issues, billing/access problems

**Escalation Path (if multi-person team):**
1. First responder (whoever detects)
2. Engineering lead (if issue >30 min unresolved)
3. Product/business owner (if user impact significant)

---

## Document Maintenance

**Review Schedule:**
- After every P0/P1 incident (update with lessons learned)
- Quarterly (even if no incidents, review for accuracy)
- When adding new features (update "Known Issues" section)

**Change Log:**
- **2025-10-15:** Initial version created
- [Future updates logged here]

---

**Document Version:** 1.0  
**Owner:** Engineering Team  
**Last Incident:** [None yet - track first incident date here]
