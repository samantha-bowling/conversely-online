# Incident Escalation Guide

## When You See 🔴 in Admin Health

### Severity: Critical (P0)

**Symptoms:**
- Safety clamp triggered
- 20+ users stuck in matching queue
- Last cron run >10 minutes ago

**Immediate Actions:**
1. Check Discord `#prod-alerts` for automated alert
2. Open Supabase logs: https://supabase.com/dashboard/project/[PROJECT_ID]/logs
3. Look for edge function errors in last 15 minutes
4. Check `docs/INCIDENT_RESPONSE.md` for specific playbooks

**Escalation:**
- If issue persists >30 minutes, run manual recovery:
  - Restart matching by clearing `is_searching` flags
  - Force-close stale rooms via SQL (see MONITORING_QUERIES.md)
  - Deploy rollback if recent change suspected

---

### Severity: Warning (🟡)

**Symptoms:**
- 10-19 users in matching queue
- Cron run 6-10 minutes stale

**Actions:**
1. Monitor for 10 more minutes
2. Check if traffic spike is organic (new user influx)
3. If persists, escalate to P0

---

## Daily Health Check Ritual (9 AM PT)

1. Open `/admin/health` (takes 30 seconds)
2. Check status indicator: 🟢 → no action, 🟡 → investigate, 🔴 → escalate
3. Scan maintenance logs for clamps
4. If healthy, close tab and continue your day

---

## Escalation Contacts

**Technical Issues:**
- Primary: Check Discord `#prod-alerts`
- Secondary: Review Supabase logs directly
- Tertiary: Consult `INCIDENT_RESPONSE.md` playbooks

**User Reports:**
- Contact: hello@conversely.online
- Response SLA: 24 hours during beta
- Escalate to P0 if multiple users report same issue

---

## Recovery Procedures

### Stuck Matching Queue (P0)

```sql
-- Clear all stale searching flags (run in Supabase SQL Editor)
UPDATE guest_sessions
SET is_searching = false
WHERE is_searching = true
  AND last_heartbeat_at < now() - interval '2 minutes';
```

### Force Close Stale Rooms (P0)

```sql
-- Close rooms where both participants are offline
-- See MONITORING_QUERIES.md for full query
UPDATE chat_rooms cr
SET status = 'ended', ended_at = now()
WHERE status = 'active'
  AND EXISTS (
    SELECT 1 FROM guest_sessions gs_a
    WHERE gs_a.id = cr.session_a
      AND gs_a.last_heartbeat_at < (now() - interval '120 seconds')
  )
  AND EXISTS (
    SELECT 1 FROM guest_sessions gs_b
    WHERE gs_b.id = cr.session_b
      AND gs_b.last_heartbeat_at < (now() - interval '120 seconds')
  );
```

### Restart Cron Jobs (P0)

If cron jobs appear stuck (last run >15 min):
1. Check Supabase dashboard for cron job status
2. Verify `pg_cron` extension is active
3. Manually trigger cleanup via edge function if needed

---

## Post-Incident Review

After resolving a P0 incident:
1. Document root cause in `docs/incidents/YYYY-MM-DD-incident-name.md`
2. Update this playbook if new procedure discovered
3. Schedule retrospective if incident took >1 hour
4. Update monitoring thresholds if false positive

---

## False Positive Handling

If Discord alert triggered but system healthy:
- Update deduplication window in `send-discord-alert` edge function
- Adjust threshold in `AdminHealth.tsx` auto-trigger logic
- Document false positive pattern in this file
