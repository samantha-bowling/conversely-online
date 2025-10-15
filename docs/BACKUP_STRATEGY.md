# Backup & Recovery Strategy

**Last Updated:** 2025-10-15  
**Project:** Conversely  
**Supabase Project ID:** `rlsontubfdpqzhoqezks`

---

## Philosophy: Privacy-First Recovery

Conversely's backup strategy is intentionally designed around **ephemeral data** and **user privacy**. Unlike traditional applications that aim for 100% data recovery, we prioritize:

1. **User Safety:** No long-term message storage = no data breach risk
2. **Regulatory Compliance:** Automatic deletion aligns with GDPR/CCPA
3. **System Integrity:** Schema and configuration are backed up, not user content

**Core Principle:** We back up **how the system works**, not **what users said**.

---

## What's Backed Up (Automatic)

### ✅ Recoverable Data

| Category | Backup Method | Retention | Recovery Time | Granularity |
|----------|---------------|-----------|---------------|-------------|
| **Database Schema** | Supabase Auto Backup | 7 days | 15-30 min | 1-minute PITR |
| **RLS Policies** | Supabase Auto Backup | 7 days | 15-30 min | 1-minute PITR |
| **Database Functions** | Supabase Auto Backup | 7 days | 15-30 min | 1-minute PITR |
| **Edge Functions** | Version Control | Unlimited | 2-5 min | Per-commit |
| **Frontend Code** | Version Control | Unlimited | 2-5 min | Per-commit |
| **Configuration** | Version Control | Unlimited | 2-5 min | Per-commit |

#### Details: Database Schema
**What's included:**
- Table definitions (`guest_sessions`, `chat_rooms`, `messages`, etc.)
- Indexes and constraints
- Column data types and defaults
- Foreign key relationships

**How to recover:**
- Via Lovable support (PITR request)
- See `docs/ROLLBACK.md` Section 2

**Why it matters:**
- Prevents catastrophic schema corruption
- Enables rollback of bad migrations
- Protects business logic encoded in database

---

#### Details: RLS Policies
**What's included:**
- All Row-Level Security policies on public schema tables
- Policy names, commands (SELECT/INSERT/UPDATE/DELETE)
- Using/Check expressions

**Example critical policies:**
```sql
-- From guest_sessions table
rls_policy: "Users can see allowed sessions"
  USING: can_see_session(id, auth.uid())

-- From messages table  
rls_policy: "Users can only send messages as themselves"
  WITH CHECK: session_id IN (SELECT id FROM guest_sessions WHERE user_id = auth.uid())
```

**How to recover:**
- Automatically restored via PITR
- Verify with: `SELECT * FROM pg_policies WHERE schemaname = 'public'`

**Why it matters:**
- RLS is our primary security layer
- Prevents unauthorized data access
- Losing policies = exposing all data

---

#### Details: Database Functions
**What's included:**
- Security definer functions (`can_see_room`, `atomic_create_match_room`)
- Maintenance procedures (`close_inactive_rooms`, `cleanup_expired_sessions`)
- Helper functions (`check_partner_heartbeat`)

**How to recover:**
- Automatically restored via PITR
- Verify with: `SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public'`

**Why it matters:**
- Functions contain core business logic
- Used by RLS policies (e.g., `can_see_room`)
- Losing them breaks application flow

---

#### Details: Edge Functions
**What's included:**
- All serverless functions in `supabase/functions/`:
  - `create-guest-session`, `match-opposite`, `send-message`
  - `end-chat`, `validate-session`, `maintenance`
  - `submit-reflection`, `submit-survey-answers`
  - Rate limiting configs, validation logic

**How to recover:**
- Via Lovable History (instant)
- See `docs/ROLLBACK.md` Section 3

**Why it matters:**
- Edge functions are the backend API layer
- Handle authentication, rate limiting, validation
- Version control = unlimited rollback window

---

#### Details: Frontend Code & Configuration
**What's included:**
- React components (`src/components/*`)
- Page routes (`src/pages/*`)
- Context providers (`src/contexts/SessionContext.tsx`)
- Config files (`src/config/constants.ts`, `tailwind.config.ts`)
- Legal documents (`public/legal/*.md`)

**How to recover:**
- Via Lovable History (instant)
- See `docs/ROLLBACK.md` Section 1

**Why it matters:**
- Frontend defines user experience
- Config files control behavior (timeouts, limits)
- Version control enables rapid rollback

---

## What's NOT Backed Up (By Design)

### ❌ Non-Recoverable Data

| Data Type | Retention | Why Not Backed Up | Privacy Impact |
|-----------|-----------|-------------------|----------------|
| **Messages** | 2 minutes | Ephemeral by design | ✅ Zero breach risk |
| **Chat Rooms (closed)** | Immediate deletion | No audit trail needed | ✅ No conversation history |
| **Active Sessions** | 24 hours max | Temporary identity | ✅ No long-term profiling |
| **Survey Answers** | 24 hours (tied to session) | Research data, not PII | ⚠️ Loss acceptable |
| **Reflections** | 24 hours (tied to session) | Feedback data, not PII | ⚠️ Loss acceptable |
| **Blocked Pairs** | Tied to session lifetime | Abuse mitigation, not audit | ✅ Privacy over history |

#### Rationale: Messages (2-Minute Expiry)
**Design Decision:**
- Messages auto-delete 2 minutes after creation
- Maintained in memory for real-time display only
- Database column: `expires_at = now() + interval '2 minutes'`

**Why no backup:**
- **Privacy:** Deleted messages = cannot be breached
- **Compliance:** GDPR "right to erasure" automatic
- **Scale:** Backing up millions of short-lived messages is wasteful

**User-Facing Benefit:**
- See `public/legal/privacy.md` Section 7: "Messages are deleted after 2 minutes"
- See `public/legal/data-retention.md` Section 4.1: "Messages are never backed up"

**Recovery Expectation:**
- If message lost due to server issue → **Cannot recover**
- Users are informed messages are ephemeral (in chat guidelines)

---

#### Rationale: Active Sessions (24-Hour Lifetime)
**Design Decision:**
- Sessions created with `expires_at = now() + interval '24 hours'`
- Cleaned up by `cleanup_expired_sessions()` maintenance job
- No persistent user accounts

**Why no backup:**
- **Privacy:** Sessions are temporary pseudonyms
- **Security:** No long-term user tracking
- **Legal:** Complies with anonymous chat requirements

**User-Facing Benefit:**
- See `public/legal/terms.md` Section 3: "Sessions expire after 24 hours"
- See `public/legal/data-retention.md` Section 4.2: "Sessions are automatically deleted"

**Recovery Expectation:**
- If session lost → User creates new one (seamless)
- Username/avatar regenerated (acceptable UX)

---

#### Rationale: Survey Answers & Reflections
**Design Decision:**
- Tied to session ID (cascading delete when session expires)
- Research/feedback data, not personally identifiable

**Why no backup:**
- **Value vs Risk:** Insights are aggregated; individual answers not critical
- **Privacy:** Even anonymous feedback shouldn't be permanent
- **Compliance:** Reduces data retention liability

**Recovery Expectation:**
- If lost within 24-hour window → **Cannot recover**
- Aggregated statistics (if any) would be recomputed from remaining data

---

## Supabase Automatic Backups (Technical Details)

### Backup Mechanism
**Provider:** Supabase (built on PostgreSQL)  
**Schedule:** Daily automatic snapshots  
**Retention:** 7 days rolling window  
**Scope:** Full database (schema + data in tables)

### Point-in-Time Recovery (PITR)
**Granularity:** 1-minute precision  
**Window:** 7 days (from most recent backup)  
**Access:** Via Lovable support (service role required)  
**Execution Time:** 15-30 minutes (depends on database size)

**How it works:**
1. Supabase maintains transaction logs (WAL - Write-Ahead Log)
2. Can "replay" transactions to any point in last 7 days
3. Restores database state to exact timestamp

**Example Use Case:**
- Bad migration deployed at `2025-10-14 15:30:00 UTC`
- Request PITR to `2025-10-14 15:25:00 UTC` (5 min before)
- Database restored to pre-migration state
- Ephemeral data (messages, sessions) from that timestamp NOT restored (already expired)

---

## Version Control Backups (Code)

### Repository: Lovable Internal
**Provider:** Lovable platform  
**Access:** Via History panel (chat or file-level)  
**Retention:** Unlimited (entire project lifetime)  
**Granularity:** Per-deployment/edit  

### What's Tracked
- All frontend code changes (`src/**`)
- All edge function changes (`supabase/functions/**`)
- Configuration files (`supabase/config.toml`, `tailwind.config.ts`)
- Legal documents (`public/legal/*.md`)

### How to Access
1. Open Lovable editor
2. Click **History** icon (top of chat)
3. Browse deployments by timestamp
4. Click **"Restore"** to rollback

**Restoration Speed:** 2-5 minutes (automatic redeployment)

---

## Data You SHOULD Back Up Externally (If Needed)

### Analytics/Metrics (Optional)
**What:** Aggregated usage statistics (not in current system)  
**How:** Export from `maintenance_logs` table periodically  
**Why:** Insights for product decisions  
**Frequency:** Weekly (if building analytics dashboard)

**Example Query:**
```sql
-- Export maintenance job stats
SELECT 
  DATE(created_at) as date,
  job_name,
  SUM(closed_count) as total_closed,
  SUM(would_close_count) as total_eligible
FROM maintenance_logs
WHERE created_at > now() - interval '90 days'
GROUP BY DATE(created_at), job_name
ORDER BY date DESC;
```

---

### Configuration Snapshots (Recommended)
**What:** Critical config values before major changes  
**How:** Manual copy of key files  
**When:** Before deploying schema migrations or rate limit changes

**Files to snapshot:**
```bash
# Before major deployment
cp src/config/constants.ts src/config/constants.ts.backup-YYYYMMDD
cp supabase/functions/_shared/rate-limit-config.ts rate-limit-config.ts.backup-YYYYMMDD
```

**Why:** Easier rollback if new configs cause issues

---

## Recovery Time Objectives (RTO)

| Failure Scenario | Recovery Method | Target RTO | Acceptable Data Loss |
|------------------|-----------------|------------|----------------------|
| **Frontend bug** | Code rollback | 5 minutes | None (code versioned) |
| **Edge function bug** | Function rollback | 5 minutes | None (code versioned) |
| **Bad schema migration** | Database PITR | 30 minutes | Ephemeral data only (<24hr) |
| **RLS policy error** | Database PITR | 30 minutes | Ephemeral data only |
| **Full system outage** | Full rollback | 60 minutes | Ephemeral data + in-flight sessions |
| **Data corruption** | Database PITR | 30 minutes | Data since corruption point |

**RTO Definition:** Time from incident detection to full service restoration

**Acceptable Data Loss:**
- Messages are ephemeral by design (2 min expiry) → Loss expected
- Sessions regenerate seamlessly → Loss acceptable
- Survey/reflection data tied to sessions → Loss acceptable for privacy

---

## Backup Verification (Monthly)

### Schema Backup Test
**Goal:** Verify PITR works correctly  
**Process:**
1. Take snapshot of current schema: `pg_dump --schema-only`
2. Request test PITR from support (non-critical timestamp)
3. Compare restored schema to snapshot
4. Document any discrepancies in `docs/incidents/`

**Last Test Date:** _[Record here after first test]_

---

### Code Rollback Test
**Goal:** Ensure version control is working  
**Process:**
1. Make trivial frontend change (e.g., comment)
2. Deploy change
3. Immediately rollback via History
4. Verify original state restored

**Last Test Date:** _[Record here after first test]_

---

## Legal Alignment: Privacy Policy

Conversely's backup strategy is **explicitly documented** in user-facing legal docs:

### From `public/legal/privacy.md`
> **Section 7: Data Retention**
> - Messages: Deleted after 2 minutes
> - Sessions: Deleted 24 hours after expiry
> - No backups of user-generated content

### From `public/legal/data-retention.md`
> **Section 4: Retention Periods**
> - Messages are never backed up (ephemeral storage only)
> - Sessions are automatically deleted and not recoverable
> - Schema and configuration backed up for 7 days

**Compliance Impact:**
- ✅ GDPR Article 5(e): "Data kept no longer than necessary"
- ✅ GDPR Article 17: "Right to erasure" (automatic via expiry)
- ✅ CCPA Section 1798.105: "Right to deletion" (default behavior)

**User Expectation Setting:**
- Users are informed messages are ephemeral (in chat guidelines)
- Terms of Service explicitly state temporary nature
- No "message history" feature = clear privacy boundary

---

## Disaster Scenarios & Recovery Strategy

### Scenario 1: Accidental Table Drop
**Example:** `DROP TABLE messages;` executed mistakenly

**Recovery:**
1. **Immediate:** Stop all edge functions from executing (disable in `config.toml`)
2. **PITR:** Request database restore to 5 minutes before drop
3. **Verify:** Check table exists and columns match: `\d+ messages`
4. **Re-enable:** Restart edge functions
5. **Document:** Log incident in `docs/incidents/`

**Data Loss:** Messages created between drop and PITR (acceptable - ephemeral)

---

### Scenario 2: Malicious RLS Policy Change
**Example:** Policy changed to `USING (true)` exposing all messages

**Recovery:**
1. **Immediate:** Disable public access (if possible) or take app offline
2. **PITR:** Request database restore to before policy change
3. **Verify:** Audit all RLS policies: `SELECT * FROM pg_policies WHERE schemaname = 'public'`
4. **Security Review:** Check audit logs for unauthorized access
5. **Notification:** Assess if breach notification required (unlikely due to 2-min expiry)

**Data Loss:** None (policy restored to secure state)

---

### Scenario 3: Edge Function Deletes All Sessions
**Example:** Bug in `cleanup_expired_sessions` deletes all rows

**Recovery:**
1. **Immediate:** Rollback edge function to previous version (Section 3)
2. **Database:** Sessions cannot be restored (not backed up by design)
3. **User Impact:** All users must create new sessions (seamless UX)
4. **Mitigation:** Add safety check to cleanup function: `WHERE expires_at < now()`

**Data Loss:** All active sessions (acceptable - users re-create seamlessly)

---

### Scenario 4: Supabase Region Outage
**Example:** AWS us-east-1 outage (Supabase infrastructure down)

**Recovery:**
1. **No Action Available:** Wait for Supabase to restore service
2. **Communication:** Post status update (if status page available)
3. **Post-Outage:** No data recovery needed (ephemeral data expired during outage)

**Data Loss:** All data during outage window (expected for ephemeral system)

---

## Backup Exclusions (Explicit)

These are **intentionally NOT backed up** and should never be added to backup scope:

| Data Type | Reason | User-Facing Impact |
|-----------|--------|-------------------|
| **IP Addresses** (logs) | Privacy compliance | ✅ No location tracking history |
| **User Agents** (logs) | No fingerprinting | ✅ No device tracking |
| **Message content** | Ephemeral by design | ✅ Cannot be subpoenaed |
| **Session tokens (JWTs)** | Security risk | ✅ Cannot be replayed |
| **Blocked pair history** | Privacy > abuse history | ✅ No permanent "ban list" |

**If ever asked to add these to backups:**
1. Review legal implications with privacy officer
2. Update Privacy Policy and Terms of Service
3. Implement opt-in mechanism (if required by law)
4. Document in `docs/incidents/` as policy change

---

## Summary: Recovery Capabilities Matrix

| Component | Backup Status | Recovery Window | Restore Method | Acceptable Loss |
|-----------|---------------|-----------------|----------------|-----------------|
| Database Schema | ✅ Backed Up | 7 days | PITR (30 min) | None |
| RLS Policies | ✅ Backed Up | 7 days | PITR (30 min) | None |
| Database Functions | ✅ Backed Up | 7 days | PITR (30 min) | None |
| Edge Functions | ✅ Versioned | Unlimited | Code rollback (5 min) | None |
| Frontend Code | ✅ Versioned | Unlimited | Code rollback (5 min) | None |
| Configuration | ✅ Versioned | Unlimited | Code rollback (5 min) | None |
| Messages | ❌ Not Backed Up | N/A | Cannot recover | All (by design) |
| Sessions | ❌ Not Backed Up | N/A | Cannot recover | All (by design) |
| Chat Rooms | ❌ Not Backed Up | N/A | Cannot recover | All (by design) |
| Survey Answers | ⚠️ Not Backed Up | N/A | Cannot recover | Acceptable |
| Reflections | ⚠️ Not Backed Up | N/A | Cannot recover | Acceptable |

---

## Next Steps: Backup Strategy Improvements (Future)

### Phase 1: Enhanced Monitoring (Post-Launch)
- Set up automated backup verification (monthly schema dumps)
- Alert on backup job failures (via Supabase webhooks)
- Track PITR request frequency (if >1/month, investigate root cause)

### Phase 2: Config Snapshotting (When Scale Increases)
- Automate config snapshots before deployments
- Store in `docs/config-snapshots/YYYYMMDD/`
- Retain last 10 snapshots

### Phase 3: Aggregated Analytics (If Product Needs)
- Export weekly metrics from `maintenance_logs`
- Store aggregated data separately (no PII)
- Enable trend analysis without compromising privacy

---

**Document Version:** 1.0  
**Review Schedule:** Quarterly or post-incident  
**Owner:** Engineering Team  
**Legal Review:** [Date of Privacy Policy alignment check]
