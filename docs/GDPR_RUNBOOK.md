# GDPR Compliance Runbook

**Purpose:** Operational guide for handling edge cases, regulatory inquiries, and data subject requests outside the self-service portal.

**Audience:** Compliance Officer, Support Team, Engineering  
**Last Updated:** October 17, 2025

---

## Table of Contents

1. [Overview](#overview)
2. [Edge Case Scenarios](#edge-case-scenarios)
3. [Email Response Templates](#email-response-templates)
4. [Audit Trail Queries](#audit-trail-queries)
5. [Incident Response](#incident-response)
6. [Supervisory Authority Inquiries](#supervisory-authority-inquiries)
7. [Escalation Paths](#escalation-paths)

---

## Overview

### When to Use This Runbook

- User emails requesting data after session expiry
- Technical failures in self-service portal
- Supervisory authority (DPA) requests
- Bulk deletion requests (e.g., court order)
- Audit trail verification for compliance
- Cascade deletion integrity issues

### Key Principles

1. **Default to Self-Service**: Always direct active users to `/privacy-requests`
2. **Transparency**: Clearly explain ephemeral data model limitations
3. **Audit Everything**: Log all manual interventions in `maintenance_logs`
4. **Speed**: Respond to inquiries within 72 hours (GDPR requirement)
5. **Documentation**: Keep records of all data subject requests for 3 years

---

## Edge Case Scenarios

### Scenario 1: User Emails After Session Expiry

**Situation:** User contacts hello@conversely.online claiming they want to delete data from a past session.

**Response:**

1. Check session status:
   ```sql
   SELECT id, user_id, created_at, expires_at
   FROM guest_sessions
   WHERE user_id = '<user_id_from_auth>';
   ```

2. If `expires_at < now()`:
   - Data has already been automatically deleted
   - Use **Template A** (see below)

3. If session still active:
   - Direct user to self-service portal
   - Use **Template B** (see below)

**Template A: Data Already Deleted**

```
Subject: Re: Data Deletion Request

Dear User,

Thank you for contacting us regarding your data deletion request.

Our system shows that your session expired on [EXPIRY_DATE]. Per our data retention policy, all session data (survey answers, messages, reflections) are automatically deleted within 24 hours of session creation.

Your data was permanently removed on [EXPIRY_DATE] and cannot be recovered. No further action is required.

For transparency, our ephemeral architecture is designed to minimize data retention and comply with GDPR principles of storage limitation (Art. 5(1)(e)).

If you have any questions, please reply to this email.

Best regards,
Conversely Privacy Team
```

---

### Scenario 2: User Claims Identity After Deletion

**Situation:** User provides session details (username, timestamp) but data is no longer available.

**Response:**

1. Verify deletion timestamp:
   ```sql
   SELECT event_metadata
   FROM maintenance_logs
   WHERE job_name = 'user_data_deleted'
     AND event_metadata->>'session_id' = '<session_id>'
   ORDER BY created_at DESC
   LIMIT 1;
   ```

2. If deletion log exists:
   - Provide confirmation receipt (see **Template C**)

3. If no deletion log (auto-expiry):
   - Use **Template A**

**Template C: Deletion Confirmation**

```
Subject: Re: Data Deletion Confirmation

Dear User,

We confirm that your data deletion request was successfully processed on [DELETION_TIMESTAMP].

Deletion Receipt:
- Session ID: [SESSION_ID]
- Deletion Date: [DELETION_TIMESTAMP]
- Records Deleted:
  * Survey Answers: [COUNT]
  * Reflections: [COUNT]
  * Blocked Users: [COUNT]
  * Auth Record: 1

Your data has been permanently removed from our systems and cannot be recovered. This deletion complies with GDPR Art. 17 (Right to Erasure).

If you have any questions, please reply to this email.

Best regards,
Conversely Privacy Team
```

---

### Scenario 3: Technical Failure in Self-Service Portal

**Situation:** User reports error when trying to export/delete data via portal.

**Response:**

1. Check edge function logs:
   ```bash
   # View recent export-user-data errors
   supabase functions logs export-user-data --limit 50

   # View recent delete-user-data errors
   supabase functions logs delete-user-data --limit 50
   ```

2. Common failure modes:
   - **JWT expired mid-request**: User's session expired during request → Use **Template B**
   - **Rate limit exceeded**: User hit 1 export/10min limit → Ask user to retry in 10 minutes
   - **Timeout (>10s)**: Database query slow → Investigate performance issue

3. If critical bug:
   - File incident report (see [Incident Response](#incident-response))
   - Manually process request (see **Manual Processing** below)

**Manual Processing (Last Resort)**

```sql
-- ⚠️ ONLY use if self-service portal is broken

-- 1. Verify user identity (check auth logs)
-- 2. Export data manually
SELECT 
  gs.id as session_id,
  gs.username,
  gs.created_at,
  gs.expires_at,
  json_agg(DISTINCT jsonb_build_object(
    'question_id', sa.question_id,
    'answer', sa.answer,
    'created_at', sa.created_at
  )) as survey_answers,
  json_agg(DISTINCT jsonb_build_object(
    'rating', r.rating,
    'feedback', r.feedback,
    'created_at', r.created_at
  )) as reflections
FROM guest_sessions gs
LEFT JOIN survey_answers sa ON sa.session_id = gs.id
LEFT JOIN reflections r ON r.session_id = gs.id
WHERE gs.user_id = '<user_id>'
  AND gs.expires_at > now()
GROUP BY gs.id;

-- 3. Send JSON to user via email (encrypted attachment)
-- 4. Log manual export in maintenance_logs
INSERT INTO maintenance_logs (job_name, event_metadata)
VALUES ('user_data_exported', jsonb_build_object(
  'session_id', '<session_id>',
  'action_source', 'manual_email',
  'reason', 'portal_technical_failure'
));
```

---

### Scenario 4: Cascade Deletion Failure

**Situation:** User deleted session but orphaned data remains (survey answers, reflections).

**Response:**

1. Verify cascade rules:
   ```sql
   -- Check foreign key constraints
   SELECT conname, conrelid::regclass, confrelid::regclass
   FROM pg_constraint
   WHERE confrelid = 'guest_sessions'::regclass
     AND contype = 'f';
   ```

2. If orphaned data found:
   ```sql
   -- Identify orphaned records
   SELECT * FROM survey_answers sa
   WHERE NOT EXISTS (
     SELECT 1 FROM guest_sessions gs WHERE gs.id = sa.session_id
   );

   -- Manual cleanup (audit first!)
   DELETE FROM survey_answers
   WHERE session_id NOT IN (SELECT id FROM guest_sessions);
   ```

3. File incident report (see [Incident Response](#incident-response))

---

## Email Response Templates

### Template B: Active Session (Redirect to Portal)

```
Subject: Re: Data Request

Dear User,

Thank you for contacting us regarding your data rights request.

Our records show that your session is still active (expires [EXPIRY_DATE]). For instant data export or deletion, please use our self-service Privacy Requests Portal:

🔗 https://conversely.online/privacy-requests

This portal allows you to:
- Export all your data in JSON format (instant download)
- Delete your data permanently (immediate)
- Edit your survey answers (rectification)

**Why self-service?** Because we don't maintain persistent user accounts, data requests must be made during your active session (24-hour window). The portal verifies your identity via your current session token.

If you experience technical issues with the portal, please reply to this email with:
- Error message (if any)
- Timestamp of issue
- Browser used

Best regards,
Conversely Privacy Team
```

---

### Template D: Supervisory Authority Inquiry

```
Subject: Re: GDPR Inquiry [CASE_NUMBER]

Dear [DPA_NAME],

Thank you for your inquiry regarding [USER_IDENTIFIER].

**Data Processing Summary:**

1. **Data Controller**: Conversely, [ADDRESS]
2. **Legal Basis**: Legitimate interests (GDPR Art. 6(1)(f))
3. **Data Retention**: Maximum 24 hours (ephemeral sessions)
4. **Data Categories**:
   - Session metadata (username, avatar, timestamps)
   - Survey responses (pre-chat questionnaire)
   - Conversation messages (expire after 2 minutes)
   - Post-chat feedback (anonymous reflections)

**Compliance Measures:**

- ✅ Self-service data export portal (Art. 15)
- ✅ Self-service deletion portal (Art. 17)
- ✅ Rectification available via survey editing (Art. 16)
- ✅ Audit trail in maintenance_logs (Art. 30)
- ✅ Automatic data expiry (privacy by design)

**Audit Trail for [USER_IDENTIFIER]:**

[Attach SQL query results showing export/deletion logs]

**Supporting Documentation:**

- Privacy Policy: https://conversely.online/privacy
- Data Retention Policy: https://conversely.online/data-retention
- GDPR Implementation Plan: [Attach docs/GDPR_IMPLEMENTATION_PLAN.md]

If you require additional information, please contact:
[DPO_NAME]
[DPO_EMAIL]
[DPO_PHONE]

Best regards,
Conversely Compliance Team
```

---

## Audit Trail Queries

### Query 1: Export Requests (Last 30 Days)

```sql
SELECT 
  created_at,
  event_metadata->>'session_id' as session_id,
  event_metadata->>'action_source' as source
FROM maintenance_logs
WHERE job_name = 'user_data_exported'
  AND created_at > now() - interval '30 days'
ORDER BY created_at DESC;
```

**Use Case:** Prove user exercised right to access

---

### Query 2: Deletion Requests (Last 90 Days)

```sql
SELECT 
  created_at as deletion_timestamp,
  event_metadata->>'session_id' as session_id,
  event_metadata->'records_deleted' as records_deleted,
  event_metadata->>'action_source' as source
FROM maintenance_logs
WHERE job_name = 'user_data_deleted'
  AND created_at > now() - interval '90 days'
ORDER BY created_at DESC;
```

**Use Case:** Deletion confirmation for user or DPA

---

### Query 3: Failed Deletion Attempts

```sql
SELECT 
  created_at,
  event_metadata->>'session_id' as session_id,
  event_metadata->>'error_message' as error
FROM maintenance_logs
WHERE job_name = 'user_data_deleted'
  AND event_metadata->>'status' = 'failed'
ORDER BY created_at DESC
LIMIT 20;
```

**Use Case:** Incident investigation, cascade integrity issues

---

### Query 4: Rate Limit Violations

```sql
-- Check if user exceeded export rate limit (1 per 10 min)
WITH user_exports AS (
  SELECT 
    event_metadata->>'session_id' as session_id,
    created_at,
    LAG(created_at) OVER (PARTITION BY event_metadata->>'session_id' ORDER BY created_at) as prev_export
  FROM maintenance_logs
  WHERE job_name = 'user_data_exported'
)
SELECT *
FROM user_exports
WHERE prev_export IS NOT NULL
  AND created_at - prev_export < interval '10 minutes';
```

**Use Case:** Abuse detection, rate limit tuning

---

## Incident Response

### Incident Severity Levels

| Severity | Definition | Response Time |
|----------|------------|---------------|
| **P0 - Critical** | Data breach, unauthorized access | Immediate (< 1 hour) |
| **P1 - High** | Self-service portal down, cascade deletion failure | 4 hours |
| **P2 - Medium** | Rate limit issues, timeout errors | 24 hours |
| **P3 - Low** | UX issues, documentation gaps | 1 week |

---

### Incident Template

**File:** `docs/incidents/YYYY-MM-DD_incident_name.md`

```markdown
# Incident Report: [TITLE]

**Date:** [DATE]
**Severity:** P1 - High
**Status:** Resolved / In Progress / Monitoring

## Summary
Brief description of incident.

## Timeline
- **14:00 UTC**: User reported error in /privacy-requests
- **14:05 UTC**: Verified edge function timeout (export-user-data)
- **14:15 UTC**: Increased function timeout from 10s to 30s
- **14:20 UTC**: Deployed fix, verified with test user
- **14:30 UTC**: Monitoring for recurrence

## Root Cause
Database query slow due to missing index on `guest_sessions.user_id`.

## Resolution
1. Added index: `CREATE INDEX idx_guest_sessions_user_id ON guest_sessions(user_id)`
2. Increased function timeout as safety buffer
3. Added monitoring query to detect slow queries

## Prevention
- Add database performance tests to CI/CD
- Set up alerts for function timeouts > 5s

## Affected Users
- User ID: [REDACTED]
- Session ID: [REDACTED]
- Manually processed export via SQL (logged in maintenance_logs)

## Follow-Up Actions
- [ ] Update GDPR_IMPLEMENTATION_PLAN.md with index requirement
- [ ] Add performance test for export function
- [ ] Review all edge functions for similar index gaps
```

---

## Supervisory Authority Inquiries

### Preparation Checklist

Before responding to DPA inquiry:

- [ ] Identify user by session ID or email (if provided)
- [ ] Run audit trail queries (see [Audit Trail Queries](#audit-trail-queries))
- [ ] Gather supporting docs (Privacy Policy, Data Retention Policy)
- [ ] Verify compliance measures (self-service portal functional)
- [ ] Prepare deletion receipt (if applicable)
- [ ] Designate authorized responder (DPO or legal counsel)

### Required Documentation

1. **Privacy Policy** (`/legal/privacy`)
2. **Data Retention Policy** (`/legal/data-retention`)
3. **GDPR Implementation Plan** (`docs/GDPR_IMPLEMENTATION_PLAN.md`)
4. **Audit Trail** (SQL query results from `maintenance_logs`)
5. **RLS Policy Documentation** (from Supabase schema)

### Response Timeline

- **Initial acknowledgment**: Within 24 hours
- **Full response**: Within 30 days (Art. 12(3))
- **Urgent requests**: Within 72 hours (if justified by DPA)

---

## Escalation Paths

### Level 1: Support Team
- Email-based requests from users
- Self-service portal technical issues
- Template responses (A, B, C)

**Escalate to Level 2 if:**
- User claims data breach
- Legal threats or formal complaint
- Supervisory authority inquiry

---

### Level 2: Compliance Officer / DPO
- Supervisory authority inquiries
- Incident reports (P0, P1)
- Manual data processing (last resort)

**Escalate to Level 3 if:**
- Formal investigation by DPA
- Court order / subpoena
- Multi-user data breach

---

### Level 3: Legal Counsel
- Litigation or legal proceedings
- Multi-jurisdiction data requests
- Significant compliance violations

---

## Appendix: Data Retention Summary

| Data Type | Retention Period | Deletion Method |
|-----------|------------------|-----------------|
| Messages | 2 minutes | Automatic (cron job) |
| Guest Sessions | 24 hours | Automatic (cron job) + cascade |
| Survey Answers | 24 hours | Cascade (on session delete) |
| Reflections | 24 hours | Cascade (on session delete) |
| Blocked Pairs | 24 hours | Cascade (on session delete) |
| Auth Records | 24 hours | Manual (via delete function) |
| Maintenance Logs (GDPR events) | 90 days | Automatic (cron job) |

**Legal Basis:** Art. 6(1)(f) (legitimate interests) + Art. 5(1)(e) (storage limitation)

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-10-17 | Initial runbook created |

---

**Owner:** Compliance Officer  
**Review Cycle:** Quarterly or after any P0/P1 incident  
**Contact:** hello@conversely.online
