# GDPR Compliance Operational Runbook

**Version:** 1.0  
**Last Updated:** October 17, 2025  
**Owner:** Compliance Officer / DPO  
**Audience:** Support Team, Engineering, Legal

---

## Table of Contents

1. [Overview](#1-overview)
2. [Edge Case Scenarios](#2-edge-case-scenarios)
3. [Email Response Templates](#3-email-response-templates)
4. [Audit Trail Queries](#4-audit-trail-queries)
5. [Incident Response](#5-incident-response)
6. [Supervisory Authority Inquiries](#6-supervisory-authority-inquiries)
7. [Escalation Paths](#7-escalation-paths)
8. [Appendix: Data Retention Summary](#appendix-data-retention-summary)

---

## 1. Overview

### Purpose

This runbook covers operational procedures for handling GDPR edge cases, regulatory inquiries, and data subject requests that fall outside the self-service portal at `/privacy-requests`.

**When to use this runbook:**
- User emails after session expiry (24+ hours)
- User claims they cannot access self-service portal
- DPA (Data Protection Authority) requests
- Audit trail verification
- Technical failures in automated deletion

### Key Principles

1. **Self-Service First:** Always direct users to `/privacy-requests` if their session is active
2. **Transparency:** Clearly explain what data exists, what's already deleted, and why
3. **Audit Everything:** Log all manual interventions in `maintenance_logs` table
4. **Prompt Response:** Acknowledge requests within 72 hours, resolve within 30 days
5. **Document Retention:** Keep records of all GDPR requests for 3 years

---

## 2. Edge Case Scenarios

### Scenario A: User Emails After Session Expiry

**Context:** User requests data export/deletion, but their session expired 24+ hours ago.

**Response Steps:**

1. **Verify session expiry** using SQL:
```sql
SELECT id, created_at, expires_at, username 
FROM guest_sessions 
WHERE expires_at < now() 
  AND created_at > now() - interval '7 days'
ORDER BY created_at DESC;
```

2. **Check if data still exists** (should be 0 rows):
```sql
SELECT COUNT(*) FROM guest_sessions WHERE expires_at < now();
SELECT COUNT(*) FROM messages WHERE expires_at < now();
```

3. **Send Template A** (see Section 3)

**Expected Outcome:**  
- User is informed their data was already deleted per retention policy
- No further action required
- Log interaction in support ticket system

---

### Scenario B: User Has Active Session but Claims Portal Issues

**Context:** User reports technical errors or cannot access `/privacy-requests`.

**Response Steps:**

1. **Verify session validity:**
```sql
SELECT id, username, created_at, expires_at, user_id
FROM guest_sessions 
WHERE expires_at > now()
  AND created_at > now() - interval '2 days'
ORDER BY created_at DESC
LIMIT 10;
```

2. **Check for recent export/deletion attempts in `maintenance_logs`:**
```sql
SELECT * FROM maintenance_logs 
WHERE job_name IN ('user_data_export', 'user_data_deletion')
  AND created_at > now() - interval '1 hour'
ORDER BY created_at DESC;
```

3. **Common failure modes:**
   - Session expired between page load and action
   - JWT token mismatch (user opened multiple tabs)
   - Rate limit exceeded (5 exports per hour)
   - Browser cache issues (stale session state)

4. **If session is valid, perform manual processing:**

**Manual Export (if portal fails):**
```sql
-- Export user data (replace <session_id>)
SELECT 
  gs.id, gs.username, gs.avatar, gs.created_at, gs.expires_at,
  sa.question_id, sa.answer_id, sa.submitted_at,
  r.mood_score, r.reflection_text, r.created_at
FROM guest_sessions gs
LEFT JOIN survey_answers sa ON sa.session_id = gs.id
LEFT JOIN reflections r ON r.session_id = gs.id
WHERE gs.id = '<session_id>';
```

**Manual Deletion (if portal fails):**
```sql
-- Delete session and cascade all data (replace <session_id>)
DELETE FROM guest_sessions WHERE id = '<session_id>';

-- Verify deletion
SELECT COUNT(*) FROM guest_sessions WHERE id = '<session_id>';
SELECT COUNT(*) FROM survey_answers WHERE session_id = '<session_id>';
SELECT COUNT(*) FROM reflections WHERE session_id = '<session_id>';
```

5. **Send Template B** with exported data or deletion confirmation

---

### Scenario C: User Claims Identity After Data Deletion

**Context:** User claims data was deleted without their consent or too early.

**Response Steps:**

1. **Check deletion logs:**
```sql
SELECT * FROM maintenance_logs 
WHERE job_name = 'user_data_deletion'
  AND created_at > now() - interval '30 days'
ORDER BY created_at DESC;
```

2. **Verify deletion was legitimate:**
   - Was it automated (session expiry)?
   - Was it user-initiated (self-service portal)?
   - Was it manual (support request)?

3. **If automated deletion:** Send Template C explaining retention policy

4. **If deletion was erroneous:** Escalate to Level 2 (Compliance Officer)

**Expected Outcome:**  
- Confirm deletion was lawful and in accordance with retention policy
- No recovery possible (data is permanently deleted)
- Offer explanation of automated deletion triggers

---

### Scenario D: Cascade Deletion Failure

**Context:** Session was deleted but orphaned data remains.

**Detection Query:**
```sql
-- Find orphaned survey answers
SELECT sa.* 
FROM survey_answers sa 
LEFT JOIN guest_sessions gs ON gs.id = sa.session_id 
WHERE gs.id IS NULL;

-- Find orphaned reflections
SELECT r.* 
FROM reflections r 
LEFT JOIN guest_sessions gs ON gs.id = r.session_id 
WHERE gs.id IS NULL;

-- Find orphaned blocked pairs
SELECT bp.* 
FROM blocked_pairs bp 
LEFT JOIN guest_sessions gs ON gs.id = bp.blocker_session_id 
WHERE gs.id IS NULL;
```

**Cleanup Actions:**
```sql
-- Delete orphaned survey answers
DELETE FROM survey_answers 
WHERE session_id NOT IN (SELECT id FROM guest_sessions);

-- Delete orphaned reflections
DELETE FROM reflections 
WHERE session_id NOT IN (SELECT id FROM guest_sessions);

-- Delete orphaned blocked pairs
DELETE FROM blocked_pairs 
WHERE blocker_session_id NOT IN (SELECT id FROM guest_sessions)
   OR blocked_session_id NOT IN (SELECT id FROM guest_sessions);
```

**Prevention:**  
- Verify CASCADE constraints are properly configured in database schema
- Monitor orphaned data daily using detection queries

---

## 3. Email Response Templates

### Template A: Session Already Expired (No Data Exists)

**Subject:** Re: Privacy Request — Session Expired (No Data Available)

```
Hello,

Thank you for contacting Conversely regarding your privacy request.

We checked our database and found that your session expired more than 24 hours ago. In accordance with our Data Retention Policy (https://conversely.online/data-retention), all data associated with expired sessions is automatically deleted.

**What has been deleted:**
✅ Your session record (username, avatar, session ID)
✅ Survey responses you submitted
✅ Any reflections or post-chat feedback
✅ All messages (auto-deleted 2 minutes after sending)

**Current status:**
No recoverable data exists in our systems. Your information has been permanently removed as designed.

**Why this happened:**
Conversely uses ephemeral sessions (24-hour lifespan) to maximize privacy. We do not retain user data beyond this window, and we cannot recover deleted data—even upon request.

If you have questions about our retention practices, please see:
- Privacy Policy: https://conversely.online/privacy
- Data Retention Policy: https://conversely.online/data-retention

Best regards,  
Conversely Support Team  
hello@conversely.online
```

---

### Template B: Active Session — Direct to Portal

**Subject:** Re: Privacy Request — Please Use Self-Service Portal

```
Hello,

Thank you for contacting us. We found that your Conversely session is still active.

**For the fastest response, please use our self-service privacy portal:**

🔗 https://conversely.online/privacy-requests

**What you can do in the portal:**
✅ Export your data (session info, survey answers, conversation metadata)
✅ Edit your survey responses
✅ Delete your data immediately
✅ Download conversation transcripts (if in an active chat)

**Why use the portal instead of email?**
- Instant action (no waiting for support)
- No identity verification delays
- Real-time data access while session is active

**Important timing:**
Your session expires on [EXPIRY_TIMESTAMP]. After this time:
- Data is automatically deleted
- No recovery is possible
- Portal access will no longer work

If you experience technical issues with the portal, please reply to this email with details.

Best regards,  
Conversely Support Team  
hello@conversely.online
```

---

### Template C: Deletion Was Legitimate (Automated Cleanup)

**Subject:** Re: Data Deletion Inquiry — Automated Retention Policy

```
Hello,

Thank you for contacting us about your data deletion concern.

Our records indicate that your data was deleted as part of our automated retention policy, not by manual intervention or error.

**What triggered the deletion:**
- Your session reached its 24-hour expiration deadline
- Our automated cleanup system (scheduled job) removed expired data
- This is standard behavior designed to protect user privacy

**Data retention timeline:**
- Messages: Auto-deleted 2 minutes after sending
- Sessions: Auto-deleted 24 hours after creation
- Survey answers, reflections, blocked pairs: Deleted when session expires

**Legal basis:**
This retention policy complies with GDPR Art. 5(1)(e) (storage limitation) and reflects our "privacy by design" approach.

**No recovery possible:**
Once data is deleted, it is permanently removed with no backups. We cannot recover your session data.

For more details, see our Data Retention Policy:
https://conversely.online/data-retention

If you believe this deletion violated your rights, you may contact your local Data Protection Authority. See Section 11 of our Privacy Policy for details.

Best regards,  
Conversely Support Team  
hello@conversely.online
```

---

### Template D: Supervisory Authority Response

**Subject:** Re: DPA Inquiry — Conversely Data Processing Summary

```
Dear [DPA Name],

Thank you for your inquiry regarding Conversely's data processing practices on behalf of [Data Subject Name/ID].

**Service Overview:**
Conversely (https://conversely.online) is an ephemeral conversation platform that facilitates short, anonymous dialogues between users. We operate without persistent accounts or long-term data storage.

**Data Processing Summary:**
- **Controller:** Conversely, hello@conversely.online
- **Legal Basis:** Legitimate interests (service delivery, security) — GDPR Art. 6(1)(f)
- **Data Collected:** Session IDs, randomized usernames/avatars, survey responses, conversation messages, IP addresses, technical logs
- **Retention:** Messages (2 min), Sessions (24 hours), Logs (30-90 days)
- **Automated Deletion:** Yes, enforced by scheduled cleanup jobs and database cascade rules

**Data Subject Request Response:**
[If specific data subject identified:]
- Session ID: [if available]
- Session Status: [active/expired/deleted]
- Data Exported: [yes/no — attach JSON if available]
- Deletion Date: [if applicable]

[If data already deleted:]
All data associated with this session was automatically deleted on [DATE] in accordance with our 24-hour retention policy. No recovery is possible.

**Compliance Documentation:**
- Privacy Policy: https://conversely.online/privacy
- Data Retention Policy: https://conversely.online/data-retention
- Self-Service GDPR Portal: https://conversely.online/privacy-requests

**Technical Measures:**
- Encryption: TLS/HTTPS for data in transit
- Access Controls: Row-Level Security (RLS) policies
- Rate Limiting: Prevents abuse and brute-force attacks
- Automated Cleanup: Cron jobs run every 5 minutes to 1 hour

**Contact for Follow-Up:**
For additional information or clarification, please contact:
- Email: hello@conversely.online
- Response Time: Within 5 business days for regulatory inquiries

We remain committed to full cooperation with your office.

Best regards,  
[Your Name]  
Compliance Officer, Conversely  
hello@conversely.online
```

---

## 4. Audit Trail Queries

### Export Requests (Last 30 Days)

```sql
SELECT 
  created_at,
  job_name,
  would_close_count AS export_count,
  safety_clamp_triggered
FROM maintenance_logs 
WHERE job_name = 'user_data_export'
  AND created_at > now() - interval '30 days'
ORDER BY created_at DESC;
```

**Expected Output:**  
- Timestamp of each export request
- Number of exports completed
- Whether rate limits were triggered

---

### Deletion Requests (Last 90 Days)

```sql
SELECT 
  created_at,
  job_name,
  closed_count AS deleted_sessions,
  would_close_count AS deletion_attempts,
  safety_clamp_triggered
FROM maintenance_logs 
WHERE job_name = 'user_data_deletion'
  AND created_at > now() - interval '90 days'
ORDER BY created_at DESC;
```

**Use Case:**  
- Compliance audits
- Verifying self-service deletion is working
- Tracking manual deletion requests

---

### Failed Deletion Attempts

```sql
SELECT * FROM maintenance_logs 
WHERE job_name = 'user_data_deletion'
  AND (safety_clamp_triggered = true OR closed_count = 0)
  AND created_at > now() - interval '30 days'
ORDER BY created_at DESC;
```

**Action Required:**  
If failures detected:
1. Check cascade constraints (see Scenario D)
2. Review edge function logs for errors
3. Escalate to Level 3 (Engineering) if persistent

---

### Rate Limit Violations (Data Exports)

```sql
SELECT * FROM maintenance_logs 
WHERE job_name = 'user_data_export'
  AND would_close_count > 5  -- Export limit per hour
  AND created_at > now() - interval '7 days'
ORDER BY created_at DESC;
```

**Expected Behavior:**  
- Rate limit: 5 exports per session per hour
- Excess requests are rejected with HTTP 429

---

## 5. Incident Response

### Incident Severity Levels

| Severity | Description | Response Time | Notification Required |
|----------|-------------|---------------|----------------------|
| **P0 (Critical)** | Data breach, unauthorized access, mass data exposure | Immediate (1 hour) | DPA + affected users |
| **P1 (High)** | Cascade deletion failure, GDPR portal outage | 4 hours | Engineering + Compliance |
| **P2 (Medium)** | Isolated deletion failure, audit trail gaps | 24 hours | Compliance Officer |
| **P3 (Low)** | Delayed response to user request, minor log issues | 3 days | Support Team |

---

### Incident Report Template

**Incident ID:** [YYYYMMDD-###]  
**Date/Time:** [ISO 8601 timestamp]  
**Severity:** [P0/P1/P2/P3]  
**Reporter:** [Name, Role]

**Summary:**  
[Brief description of the incident]

**Timeline:**
- [Timestamp] — Incident detected
- [Timestamp] — Initial response
- [Timestamp] — Root cause identified
- [Timestamp] — Resolution deployed
- [Timestamp] — Post-incident review completed

**Root Cause:**  
[Technical explanation of what went wrong]

**Resolution:**  
[Steps taken to resolve the incident]

**Prevention:**  
[Changes implemented to prevent recurrence]

**Affected Users:**  
[Number of users affected, if known]

**DPA Notification Required:** [Yes/No]  
**User Notification Required:** [Yes/No]

**Follow-Up Actions:**
- [ ] Update runbook
- [ ] Deploy monitoring alerts
- [ ] Schedule post-incident review
- [ ] Document in incident log

---

## 6. Supervisory Authority Inquiries

### Preparation Checklist

When a DPA (Data Protection Authority) contacts you:

- [ ] **Acknowledge receipt within 48 hours**
- [ ] **Identify the data subject** (session ID, username, timestamp)
- [ ] **Verify data status** (active, expired, deleted)
- [ ] **Run audit trail queries** (Section 4)
- [ ] **Gather technical documentation** (Privacy Policy, Retention Policy, RLS policies)
- [ ] **Prepare response using Template D** (Section 3)
- [ ] **Escalate to Legal Counsel** if contentious or adversarial

---

### Required Documentation

Always include in DPA responses:
1. **Privacy Policy** (https://conversely.online/privacy)
2. **Data Retention Policy** (https://conversely.online/data-retention)
3. **Technical Measures Summary** (encryption, RLS, rate limiting)
4. **Data Processing Record (GDPR Art. 30)**
   - Categories of data processed
   - Purposes of processing
   - Retention periods
   - Sub-processors (Lovable Cloud/Supabase, hCaptcha)
5. **Audit Trail** (export/deletion logs for relevant time period)

---

### Response Timelines

| Request Type | Response Deadline | Notes |
|--------------|-------------------|-------|
| **Informal inquiry** | 5 business days | Use Template D |
| **Formal data subject request** | 30 days (GDPR Art. 12) | Provide JSON export or deletion confirmation |
| **Compliance audit notice** | Varies (typically 14-30 days) | Engage Legal Counsel |
| **Breach notification** | 72 hours (GDPR Art. 33) | Critical — escalate immediately |

---

## 7. Escalation Paths

### Level 1: Support Team
**Handles:**
- Email inquiries about privacy requests
- Directing users to self-service portal
- Template responses (A, B, C)

**Escalate to Level 2 if:**
- User disputes automated deletion
- Technical failure in self-service portal
- Request involves legal interpretation

---

### Level 2: Compliance Officer / DPO
**Handles:**
- DPA inquiries
- Audit trail verification
- Manual deletion/export requests
- Incident response (P2-P3)

**Escalate to Level 3 if:**
- Cascade deletion failures persist
- Security vulnerability detected
- Incident severity P0-P1

---

### Level 3: Engineering + Legal Counsel
**Handles:**
- Critical incidents (P0-P1)
- Database corruption or cascade failures
- Adversarial regulatory inquiries
- Policy violations with legal implications

**Authority:**
- Can authorize emergency database access
- Can approve policy changes
- Coordinates with external legal counsel

---

## Appendix: Data Retention Summary

| Data Type | Retention | Deletion Method | Legal Basis |
|-----------|-----------|-----------------|-------------|
| Messages | 2 minutes | Automated (cron) | Privacy by design (GDPR Art. 5) |
| Sessions | 24 hours | Automated (cron) | Session lifecycle |
| Survey Answers | 24 hours | Cascade | Tied to session |
| Reflections | 24 hours | Cascade | Tied to session/room |
| Blocked Pairs | 24 hours | Cascade | Tied to session |
| Security Logs | 60 days | Scheduled cleanup | Fraud prevention (GDPR Art. 6) |
| Error Logs | 30 days | Scheduled cleanup | Platform stability |
| Maintenance Logs | 90 days | Scheduled cleanup | System health monitoring |

**Key Takeaway:**  
Most user data is ephemeral (24 hours or less). Technical logs are retained longer for security and operational purposes but contain no message content.

---

**Document Control:**
- **Version:** 1.0
- **Last Updated:** October 17, 2025
- **Next Review:** January 17, 2026
- **Owner:** Compliance Officer
- **Approver:** Legal Counsel

---

**End of GDPR Compliance Operational Runbook**