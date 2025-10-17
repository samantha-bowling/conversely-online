# GDPR Delete/Export Implementation Plan

**Status:** 📋 Ready for Implementation  
**Estimated Effort:** 27 hours (~3.5 days)  
**Priority:** Pre-Launch Critical  
**Compliance Target:** GDPR Articles 5, 12, 15-17, 20

---

## Executive Summary

This plan implements a **real-time self-service GDPR portal** optimized for Conversely's ephemeral architecture. Unlike traditional GDPR implementations, this solution embraces data minimization principles by providing instant data access and deletion *only while sessions are active* (24-hour window).

### Key Design Principles

1. **Ephemeral-First Architecture**: No email-based identity verification needed
2. **Real-Time Self-Service**: Export and deletion available instantly in-session
3. **Privacy by Design**: Automatic data expiry reduces compliance burden
4. **Audit Trail**: All GDPR actions logged for regulatory defense
5. **Plain Language UX**: Transparent explanations of ephemeral data model

---

## Compliance Coverage

| GDPR Right | Status | Implementation |
|------------|--------|----------------|
| **Access (Art. 15)** | ✅ Full | `/privacy-requests/export` with structured JSON |
| **Portability (Art. 20)** | ✅ Full | Machine-readable JSON format |
| **Erasure (Art. 17)** | ✅ Full | `/privacy-requests/delete` with immediate JWT revocation |
| **Rectification (Art. 16)** | ✅ Full | `/survey/edit` for updating survey answers |
| **Restriction (Art. 18)** | ⚠️ N/A | Not feasible for ephemeral sessions |
| **Objection (Art. 21)** | ✅ Implicit | Users can delete session to stop processing |
| **Automated Decisions (Art. 22)** | ✅ Transparent | No profiling beyond matching algorithm |

---

## Implementation Phases

### **Phase 1: Backend (Edge Functions) — 8 hours**

#### 1.1 Export User Data Function
**File:** `supabase/functions/export-user-data/index.ts`

**Functionality:**
- Query all user data linked to `auth.uid()`
- Join across: `guest_sessions`, `survey_answers`, `messages`, `chat_rooms`, `reflections`, `blocked_pairs`
- **Critical:** Only return data where `expires_at > now()`
- Rate limit: 1 export per 10 minutes
- Log export events to `maintenance_logs`

**Response Format:**
```json
{
  "export_timestamp": "2025-10-17T19:45:00Z",
  "session_id": "uuid",
  "data_retention_notice": "This data expires automatically within 24 hours",
  "data": {
    "session": {
      "username": "BrightStorm",
      "created_at": "2025-10-17T19:00:00Z",
      "expires_at": "2025-10-18T19:00:00Z",
      "is_test": false,
      "reputation_score": 0,
      "explanation": "Your anonymous session identity and metadata"
    },
    "survey_answers": [
      {
        "question_id": "reading-format",
        "answer": "Physical books",
        "created_at": "2025-10-17T19:01:00Z",
        "explanation": "Your pre-chat survey responses used for matching"
      }
    ],
    "messages": {
      "count": 0,
      "explanation": "Messages expire after 2 minutes and are not stored long-term",
      "note": "To save conversation history, use 'Download Transcript' during active chat"
    },
    "reflections": [
      {
        "rating": 4,
        "feedback": "Great conversation!",
        "created_at": "2025-10-17T19:30:00Z",
        "explanation": "Your post-chat feedback (anonymous)"
      }
    ],
    "blocked_pairs": [],
    "explanation": "Sessions you blocked during this visit"
  }
}
```

**Security:**
- Verify JWT issuer/audience
- RLS policy: `can_export_own_session(session_id, user_id)`
- Timeout fallback: Return partial export after 10s
- Log telemetry: `user_data_exported` event

---

#### 1.2 Delete User Data Function
**File:** `supabase/functions/delete-user-data/index.ts`

**Functionality:**
- Validate session ownership (`session.user_id === auth.uid()`)
- Delete in transactional order:
  1. Messages (if any exist)
  2. Guest session (triggers cascade deletion via FK constraints)
  3. Auth user record (`auth.users`)
- Revoke JWT via `auth.admin.signOut(user_id)`
- Rate limit: 1 deletion per 24 hours
- Return deletion receipt

**Response Format:**
```json
{
  "status": "deleted",
  "deletion_timestamp": "2025-10-17T19:50:00Z",
  "session_id": "uuid",
  "records_deleted": {
    "survey_answers": 5,
    "reflections": 1,
    "blocked_pairs": 0,
    "messages": 0,
    "auth_user": 1
  },
  "receipt": {
    "message": "Your data has been permanently deleted",
    "irreversible": true,
    "compliance_note": "Deletion complies with GDPR Art. 17 (Right to Erasure)"
  }
}
```

**Audit Logging:**
```typescript
await supabase.from('maintenance_logs').insert({
  job_name: 'user_data_deleted',
  event_metadata: {
    session_id: sessionId,
    user_id: userId,
    action_source: 'self_service_portal',
    records_deleted: {
      survey_answers: 5,
      reflections: 1,
      blocked_pairs: 0
    }
  }
});
```

**Security:**
- Cascade integrity check before deletion
- RLS policy: `can_delete_own_session(session_id, user_id)`
- Verify `expires_at > now()` (no deletion of already-expired sessions)

---

#### 1.3 Update Survey Answers Function (Rectification)
**File:** `supabase/functions/update-survey-answers/index.ts`

**Functionality:**
- Allow users to edit survey answers before session expiry
- Validate question IDs against allowed list
- Rate limit: 3 updates per 10 minutes
- Log rectification events

**Request Format:**
```json
{
  "session_id": "uuid",
  "updates": [
    {
      "question_id": "reading-format",
      "new_answer": "E-books"
    }
  ]
}
```

**Security:**
- Verify `session.user_id === auth.uid()`
- Validate `question_id` against `SURVEY_QUESTIONS` enum
- RLS policy: `can_update_own_survey_answers(session_id, user_id)`

---

### **Phase 2: Frontend (Privacy Portal) — 10 hours**

#### 2.1 Update `/privacy-requests` Page

**New Components:**

1. **Session Status Card**
```tsx
<Card>
  <CardHeader>
    <h2>Your Session Status</h2>
  </CardHeader>
  <CardContent>
    <p>Session expires in: <strong>22h 15m</strong></p>
    <Progress value={92} className="mt-2" />
    <p className="text-muted-foreground text-sm mt-2">
      Data export and deletion must be done before expiry
    </p>
  </CardContent>
</Card>
```

2. **"Explain My Data" Section**
```tsx
<Accordion>
  <AccordionItem value="what-data">
    <AccordionTrigger>What data do you store about me?</AccordionTrigger>
    <AccordionContent>
      <ul>
        <li><strong>Survey Answers:</strong> Your pre-chat responses used for matching</li>
        <li><strong>Messages:</strong> Expire after 2 minutes (not stored long-term)</li>
        <li><strong>Reflections:</strong> Post-chat feedback (anonymous)</li>
        <li><strong>Blocked Users:</strong> Sessions you blocked during this visit</li>
      </ul>
      <p className="text-muted-foreground mt-2">
        All data are deleted automatically within 24 hours or instantly on request.
      </p>
    </AccordionContent>
  </AccordionItem>
</Accordion>
```

3. **Preview Panel (Optional)**
- Show data summary before export:
  - Survey Answers: 5 responses
  - Messages: 0 (expired)
  - Reflections: 1 rating
  - Blocked Users: 0

4. **Action Buttons**
```tsx
<div className="flex gap-4">
  <Button onClick={handleExport}>
    Export My Data
  </Button>
  <Button onClick={handleEditSurvey} variant="outline">
    Edit Survey Answers
  </Button>
  <Button onClick={handleDelete} variant="destructive">
    Delete My Data
  </Button>
</div>
```

**Delete Confirmation Dialog:**
```tsx
<Dialog>
  <DialogContent>
    <DialogTitle>Delete All Your Data?</DialogTitle>
    <DialogDescription>
      This action is irreversible. You will:
      <ul>
        <li>End your current session immediately</li>
        <li>Permanently delete all survey answers, reflections, and blocked users</li>
        <li>Be signed out and redirected to the home page</li>
      </ul>
    </DialogDescription>
    <Checkbox>I understand this action is irreversible</Checkbox>
    <DialogFooter>
      <Button onClick={confirmDelete} disabled={!checkboxChecked}>
        Confirm Deletion
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

#### 2.2 Create `/survey/edit` Page (Rectification Flow)

**Functionality:**
- Load current survey answers from `survey_answers` table
- Display editable form with same questions from survey page
- Call `update-survey-answers` edge function on save
- Show success toast: "Survey answers updated"

**UX Notes:**
- Reminder: "Your answers can be changed until your session expires"
- Auto-save draft in localStorage (client-side only)

---

#### 2.3 In-Chat Transcript Download

**File:** `src/components/chat/ChatHeader.tsx`

**Functionality:**
- Add "Download Transcript" button (only visible during active chat)
- On click:
  - Fetch all messages in current room via `supabase.from('messages').select('*').eq('room_id', roomId)`
  - Generate client-side JSON:
    ```json
    {
      "conversation_id": "uuid",
      "started_at": "2025-10-17T19:00:00Z",
      "message_retention_policy": "2 minutes client-side only",
      "messages": [
        { "sender": "You", "content": "Hello!", "timestamp": "2025-10-17T19:01:00Z" },
        { "sender": "Partner", "content": "Hi there!", "timestamp": "2025-10-17T19:01:15Z" }
      ]
    }
    ```
  - Download as `conversation-transcript-[room_id].json`
- **No server storage** — purely client-side operation

**Ephemeral Notice Banner:**
```tsx
<Alert>
  <AlertTitle>Messages Expire Quickly</AlertTitle>
  <AlertDescription>
    Messages are deleted after 2 minutes. Download this transcript before ending your chat.
  </AlertDescription>
  <Button onClick={handleDownloadTranscript} size="sm">
    Download Now
  </Button>
</Alert>
```

---

### **Phase 3: Legal Documentation — 3 hours**

#### 3.1 Update `public/legal/privacy.md`

**Section 7.6 "Exercising Your Rights"**

Replace:
> To exercise any of these rights, contact us at hello@conversely.online

With:
> **Self-Service Portal**: To export or delete your data, visit the [Privacy Requests Portal](/privacy-requests) while your session is active. Data export and deletion are instant and self-service.
>
> **Why Real-Time Access?**: Because we do not maintain persistent user identifiers, data requests must be made during your active session (24-hour window). After expiry, your data no longer exist and cannot be recovered. This design ensures compliance with GDPR principles of purpose limitation and storage limitation (Art. 5(1)(b)-(e)).
>
> **For expired sessions**: If you need assistance with a past session, contact hello@conversely.online (note: data may no longer be available).

**Section 11 "Legal Basis for Processing"**

Add:
> We process your data based on **legitimate interests** (GDPR Art. 6(1)(f)) for providing and securing the service. Our ephemeral architecture minimizes retention to 24 hours or less, ensuring proportionality under Recital 47.

---

#### 3.2 Update `public/legal/data-retention.md`

**Section 6 "Manual Deletion Requests"**

Add:
> **Self-Service Deletion**: Users can delete their data instantly via the [Privacy Requests Portal](/privacy-requests) during their active session. This is the preferred method.
>
> **Email Requests**: For edge cases (expired sessions, technical issues), contact hello@conversely.online. Note: If your session has expired, data may have already been automatically deleted.

---

#### 3.3 Create `docs/GDPR_RUNBOOK.md`

See separate file: `GDPR_RUNBOOK.md`

---

### **Phase 4: Testing & Validation — 4 hours**

#### Test Matrix

| Test Case | Expected Outcome |
|-----------|------------------|
| **Access Rights** |
| Export data with active session | ✅ JSON downloads with all current data + explanations |
| Export data after session expires | ❌ 401 Unauthorized (session expired) |
| Preview data before export | ✅ Summary shows: 5 survey answers, 0 messages, 1 reflection |
| **Rectification** |
| Edit survey answer via /survey/edit | ✅ Answer updated, toast confirms success |
| Edit survey answer after expiry | ❌ 401 Unauthorized |
| Attempt to edit invalid question_id | ❌ 400 Bad Request |
| **Deletion** |
| Delete data with active session | ✅ Session deleted, JWT revoked, redirected to home |
| Delete data twice | ❌ 401 Unauthorized (already deleted) |
| Delete without checkbox confirmation | ❌ Button disabled |
| **Security** |
| Attempt to export another user's data | ❌ 403 Forbidden (RLS blocks) |
| Exceed rate limit (2 exports in 5 min) | ❌ 429 Too Many Requests |
| Trigger export timeout (>10s) | ✅ Partial export returned with notice |
| **Transcript Download** |
| Download transcript during active chat | ✅ JSON file with messages + metadata |
| Download transcript after 2 minutes | ✅ Empty messages array (expired) |
| Download transcript after chat ends | ❌ Button hidden |

#### RLS Verification Queries

```sql
-- Test: User A cannot export User B's data
SET LOCAL role = 'authenticated';
SET LOCAL request.jwt.claims.sub = 'user-a-uuid';

SELECT * FROM guest_sessions WHERE user_id = 'user-b-uuid';
-- Expected: Empty result (blocked by RLS)

-- Test: User can only delete their own session
DELETE FROM guest_sessions WHERE user_id = 'user-b-uuid';
-- Expected: 0 rows affected (blocked by RLS)
```

---

### **Phase 5: Deployment — 2 hours**

#### Pre-Deployment Checklist

- [ ] All edge functions deployed
- [ ] RLS policies verified on all tables
- [ ] Rate limits configured in edge functions
- [ ] Audit logging enabled in `maintenance_logs`
- [ ] Legal docs updated (privacy.md, data-retention.md)
- [ ] GDPR_RUNBOOK.md created
- [ ] Test matrix executed (10/10 passing)
- [ ] Monitoring queries added to `docs/MONITORING_QUERIES.md`

#### Monitoring Queries

```sql
-- Track GDPR export requests (last 24h)
SELECT 
  job_name,
  event_metadata->>'action_source' as source,
  COUNT(*) as count
FROM maintenance_logs
WHERE job_name = 'user_data_exported'
  AND created_at > now() - interval '24 hours'
GROUP BY job_name, source;

-- Track GDPR deletion requests (last 7 days)
SELECT 
  DATE(created_at) as date,
  COUNT(*) as deletions,
  SUM((event_metadata->'records_deleted'->>'survey_answers')::int) as survey_answers_deleted
FROM maintenance_logs
WHERE job_name = 'user_data_deleted'
  AND created_at > now() - interval '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Check for failed deletions (safety monitoring)
SELECT *
FROM maintenance_logs
WHERE job_name = 'user_data_deleted'
  AND event_metadata->>'status' = 'failed'
ORDER BY created_at DESC
LIMIT 10;
```

---

## Success Criteria

### Functional
- ✅ Users can export data instantly while session is active
- ✅ Users can delete data immediately (including JWT revocation)
- ✅ Users can rectify survey answers before expiry
- ✅ Export includes all personal data with plain-language explanations
- ✅ Deletion is transactional and auditable
- ✅ In-chat transcript download works during active conversation

### Security
- ✅ Zero false positives (users can't access others' data)
- ✅ RLS policies block cross-user access
- ✅ Rate limits prevent abuse
- ✅ JWT issuer/audience verification in all edge functions

### Compliance
- ✅ Fulfills GDPR Art. 15 (access), 16 (rectification), 17 (erasure), 20 (portability)
- ✅ Audit trail queryable for supervisory authorities
- ✅ Legal docs explicitly cite GDPR articles
- ✅ "Privacy by design" principles evident in architecture

### UX
- ✅ Clear explanations of ephemeral data model
- ✅ Session expiry countdown visible
- ✅ Deletion requires explicit confirmation
- ✅ Transcript download includes retention policy notice

---

## Rollback Plan

If critical issues arise during deployment:

1. **Immediate Actions:**
   - Revert edge function changes via Supabase dashboard
   - Re-enable "Coming in Phase 5B" placeholder on `/privacy-requests`
   - Disable new routes (`/survey/edit`)

2. **Fallback Mode:**
   - Email-based requests (manual processing via hello@conversely.online)
   - Use GDPR_RUNBOOK.md templates for manual responses

3. **Investigation:**
   - Check edge function logs for errors
   - Verify RLS policies aren't overly restrictive
   - Test cascade deletion integrity

4. **Re-Deployment:**
   - Fix root cause
   - Re-run test matrix
   - Deploy with monitoring enabled

---

## Future Enhancements (Post-Launch)

### Optional Add-Ons
| Feature | Value | Effort |
|---------|-------|--------|
| Anonymized metrics export (opt-in) | Transparency for users | Medium |
| Data Deletion Receipt (signed JSON) | Enhanced proof of deletion | Low |
| DPO Admin Interface (`/admin/privacy-requests`) | Compliance officer visibility | Medium |
| Multi-language GDPR docs | EU market expansion | High |

---

## References

- **GDPR Full Text**: [EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/oj)
- **Art. 5**: Principles (data minimization, storage limitation)
- **Art. 12**: Transparent information, communication
- **Art. 15**: Right of access
- **Art. 16**: Right to rectification
- **Art. 17**: Right to erasure
- **Art. 20**: Right to data portability
- **Art. 30**: Records of processing activities (audit trail)
- **Recital 47**: Legitimate interests
- **Recital 58**: Easy access to data rights

---

**Document Version:** 1.0  
**Last Updated:** October 17, 2025  
**Owner:** Product & Compliance Team  
**Review Cycle:** Pre-launch + quarterly post-launch
