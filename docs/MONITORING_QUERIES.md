# Manual Monitoring Queries

**Last Updated:** 2025-10-15  
**Project:** Conversely  
**Supabase Project ID:** `rlsontubfdpqzhoqezks`

---

## Purpose

This document provides SQL queries for **proactive manual health checks** when automated monitoring is not yet implemented. These queries help detect issues before they impact users.

**Recommended Frequency:**
- **Daily:** Queries 1-3 (overall health)
- **Weekly:** Queries 4-6 (system metrics)
- **Monthly:** Queries 7-9 (abuse detection, trends)

**Access:** Run via Lovable backend SQL editor  
<lov-actions>
  <lov-open-backend>View Backend</lov-open-backend>
</lov-actions>

---

## Quick Health Dashboard (Run Daily)

```sql
-- QUERY 1: Overall System Health Snapshot
-- What it checks: Active sessions, chats, messages, recent activity
-- Expected values: Varies by traffic, but all counts should be > 0 during active hours
-- 🚨 Red flags: 0 active_sessions AND active_chats > 0 (orphaned rooms)

SELECT 
  (SELECT COUNT(*) FROM guest_sessions WHERE expires_at > now()) as active_sessions,
  (SELECT COUNT(*) FROM guest_sessions WHERE is_searching = true) as searching_users,
  (SELECT COUNT(*) FROM chat_rooms WHERE status = 'active') as active_chats,
  (SELECT COUNT(*) FROM messages WHERE expires_at > now()) as recent_messages,
  (SELECT COUNT(*) FROM guest_sessions WHERE last_heartbeat_at > now() - interval '30 seconds') as users_online_now;
```

**Interpretation:**
- `active_sessions`: Total users with valid sessions (0-1000s depending on traffic)
- `searching_users`: Users in matching queue (0-50 typically)
- `active_chats`: Ongoing conversations (0-500 typically)
- `recent_messages`: Messages sent in last 2 minutes (0-100 typically)
- `users_online_now`: Users with fresh heartbeat (<30s) (0-1000s)

**Red Flags:**
- `searching_users > 0` for >5 minutes → Matching stuck
- `active_chats = 0` during peak hours → Matching broken
- `recent_messages = 0` but `active_chats > 10` → Message sending broken
- `users_online_now = 0` but `active_sessions > 0` → Heartbeat system broken

---

```sql
-- QUERY 2: System Activity (Last 24 Hours)
-- What it checks: New sessions, matches, messages, chat completions
-- Expected values: All > 0 in last 24hr (unless very low traffic)
-- 🚨 Red flags: new_matches = 0 for 24hr (matching system down)

SELECT 
  (SELECT COUNT(*) FROM guest_sessions WHERE created_at > now() - interval '24 hours') as new_sessions_24h,
  (SELECT COUNT(*) FROM chat_rooms WHERE created_at > now() - interval '24 hours') as new_matches_24h,
  (SELECT COUNT(*) FROM messages WHERE created_at > now() - interval '24 hours') as messages_sent_24h,
  (SELECT COUNT(*) FROM chat_rooms WHERE status = 'ended' AND ended_at > now() - interval '24 hours') as chats_ended_24h,
  (SELECT COUNT(*) FROM reflections WHERE created_at > now() - interval '24 hours') as reflections_submitted_24h;
```

**Interpretation:**
- `new_sessions_24h`: User acquisition rate (10-1000s depending on launch phase)
- `new_matches_24h`: Matching success rate (should be ~50% of sessions)
- `messages_sent_24h`: Engagement metric (average 10-50 messages per chat)
- `chats_ended_24h`: Completion rate (should match matches from 2-60 min ago)
- `reflections_submitted_24h`: Feedback participation (~20-50% of ended chats)

**Red Flags:**
- `new_matches_24h = 0` → Matching broken
- `messages_sent_24h / new_matches_24h < 5` → Users not engaging
- `chats_ended_24h / new_matches_24h < 0.8` → Chats stuck or users abandoning
- `reflections_submitted_24h / chats_ended_24h < 0.1` → Reflection dialog not showing

---

```sql
-- QUERY 3: Maintenance Job Health (Last 10 Runs)
-- What it checks: Automated cleanup jobs running successfully
-- Expected values: closed_count < 100 (safety clamp), no clamps triggered
-- 🚨 Red flags: safety_clamp_triggered = true (>100 rooms eligible for closure)

SELECT 
  job_name,
  created_at,
  would_close_count,
  closed_count,
  safety_clamp_triggered
FROM maintenance_logs
ORDER BY created_at DESC
LIMIT 10;
```

**Interpretation:**
- `job_name`: Which cleanup job ran (`close_inactive_rooms`)
- `would_close_count`: Rooms eligible for closure
- `closed_count`: Rooms actually closed (should match `would_close_count` if no clamp)
- `safety_clamp_triggered`: `true` = >100 rooms were eligible (aborted for safety)

**Red Flags:**
- `safety_clamp_triggered = true` → Investigate why so many stale rooms exist
- `would_close_count > 50` consistently → Heartbeat issues or users disconnecting
- No rows in last 15 minutes → Maintenance job not running (check cron)
- `closed_count = 0` but `active_chats > 100` → Cleanup logic broken

**Expected Pattern:**
- `would_close_count` should be 0-10 normally (rooms expire naturally)
- Spikes to 20-50 during off-peak hours acceptable
- Spikes >100 indicate systemic issue (heartbeat failure, network outage)

---

## Matching System Health (Run Weekly)

```sql
-- QUERY 4: Matching Metrics (Current State)
-- What it checks: Users waiting to match, match success rate
-- Expected values: avg_wait_time < 30 seconds, match_rate > 80%
-- 🚨 Red flags: users_searching > 10 for >5 min, avg_wait_time > 60 sec

WITH matching_data AS (
  SELECT 
    gs.id,
    gs.created_at,
    gs.is_searching,
    gs.last_matched_at,
    EXTRACT(EPOCH FROM (gs.last_matched_at - gs.created_at)) as time_to_match_sec
  FROM guest_sessions gs
  WHERE gs.created_at > now() - interval '1 hour'
    AND gs.last_matched_at IS NOT NULL
)
SELECT 
  (SELECT COUNT(*) FROM guest_sessions WHERE is_searching = true) as users_searching_now,
  COUNT(*) as matches_last_hour,
  ROUND(AVG(time_to_match_sec)) as avg_wait_time_sec,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY time_to_match_sec)) as median_wait_time_sec,
  ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY time_to_match_sec)) as p95_wait_time_sec,
  MAX(time_to_match_sec) as max_wait_time_sec
FROM matching_data;
```

**Interpretation:**
- `users_searching_now`: Users currently in queue (0-10 typical, >20 = issue)
- `matches_last_hour`: Successful matches (should be >0 during active hours)
- `avg_wait_time_sec`: Average time from session creation to match (~10-30 sec ideal)
- `median_wait_time_sec`: Median wait (more robust than avg)
- `p95_wait_time_sec`: 95th percentile (worst 5% of experiences, should be <60 sec)
- `max_wait_time_sec`: Longest wait (if >300 sec, user likely gave up)

**Red Flags:**
- `users_searching_now > 10` for >5 minutes → Matching stuck (check heartbeats)
- `avg_wait_time_sec > 60` → Low traffic or matching algorithm issues
- `p95_wait_time_sec > 120` → Significant portion of users waiting too long
- `matches_last_hour = 0` during peak hours → Matching system broken

**Diagnostic Steps if Red Flags:**
1. Check heartbeats: `SELECT COUNT(*) FROM guest_sessions WHERE last_heartbeat_at < now() - interval '30 seconds'`
2. Check for stale rooms: `SELECT COUNT(*) FROM chat_rooms WHERE status = 'active' AND last_activity < now() - interval '5 minutes'`
3. Manually trigger cleanup: `SELECT close_inactive_rooms()`

---

```sql
-- QUERY 5: Matching Failures (Last 24 Hours)
-- What it checks: Sessions that never matched
-- Expected values: unmatch_rate < 20% (some users abandon before match)
-- 🚨 Red flags: unmatch_rate > 50% (matching broken or low traffic)

WITH session_outcomes AS (
  SELECT 
    gs.id,
    gs.created_at,
    gs.last_matched_at,
    CASE 
      WHEN gs.last_matched_at IS NOT NULL THEN 'matched'
      WHEN gs.expires_at < now() THEN 'expired_unmatched'
      ELSE 'still_active'
    END as outcome
  FROM guest_sessions gs
  WHERE gs.created_at > now() - interval '24 hours'
)
SELECT 
  outcome,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM session_outcomes
GROUP BY outcome
ORDER BY count DESC;
```

**Interpretation:**
- `matched`: Sessions that successfully found a partner
- `expired_unmatched`: Sessions that expired without matching (users gave up or low traffic)
- `still_active`: Sessions currently active (not yet matched or chatting)

**Expected Ratios:**
- `matched`: 60-80%
- `expired_unmatched`: 10-30% (users close tab, lose interest)
- `still_active`: 5-20% (depends on current traffic)

**Red Flags:**
- `expired_unmatched > 50%` → Matching broken or extremely low traffic
- `matched < 40%` → User experience problem (UI confusing or system slow)
- `still_active > 50%` → Sessions not expiring (cleanup job broken)

---

## Message Flow Health (Run Weekly)

```sql
-- QUERY 6: Message Activity (Last 24 Hours)
-- What it checks: Message throughput, sender diversity
-- Expected values: avg_messages_per_chat > 5, unique_senders matches active_users
-- 🚨 Red flags: avg_messages_per_chat < 3 (users not engaging)

WITH message_stats AS (
  SELECT 
    m.room_id,
    COUNT(*) as message_count,
    COUNT(DISTINCT m.session_id) as unique_senders,
    MIN(m.created_at) as first_message,
    MAX(m.created_at) as last_message
  FROM messages m
  WHERE m.created_at > now() - interval '24 hours'
  GROUP BY m.room_id
)
SELECT 
  COUNT(DISTINCT room_id) as active_chats_24h,
  SUM(message_count) as total_messages_24h,
  ROUND(AVG(message_count)) as avg_messages_per_chat,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY message_count)) as median_messages_per_chat,
  MIN(message_count) as min_messages,
  MAX(message_count) as max_messages,
  ROUND(AVG(EXTRACT(EPOCH FROM (last_message - first_message)) / 60)) as avg_chat_duration_min
FROM message_stats;
```

**Interpretation:**
- `active_chats_24h`: Rooms with at least 1 message (matches `new_matches_24h` from Query 2)
- `total_messages_24h`: Total message throughput (10-1000s)
- `avg_messages_per_chat`: Engagement metric (10-50 ideal, <5 = poor engagement)
- `median_messages_per_chat`: More robust than avg (less affected by outliers)
- `min_messages`: Lowest engagement chat (1 = immediate disconnect)
- `max_messages`: Highest engagement chat (>200 = exceptional conversation)
- `avg_chat_duration_min`: Average time from first to last message (10-30 min ideal)

**Red Flags:**
- `avg_messages_per_chat < 5` → Users not engaging (UX issue or spam)
- `avg_chat_duration_min < 5` → Chats ending too quickly (poor matches or harassment)
- `median_messages_per_chat = 1` → Most chats end immediately (critical UX issue)
- `max_messages > 500` → Potential abuse (spamming, evading rate limits)

---

```sql
-- QUERY 7: Message Sending Patterns (Detect Issues)
-- What it checks: Rate limit hits, message latency distribution
-- Expected values: No or minimal rate limit rejections
-- 🚨 Red flags: High rejection rate (>5% of attempts)

-- Note: This query assumes edge function logs are accessible
-- Since we don't log rejections in DB, this is a proxy check via message gaps

WITH message_timing AS (
  SELECT 
    session_id,
    created_at,
    LAG(created_at) OVER (PARTITION BY session_id ORDER BY created_at) as prev_message_at,
    EXTRACT(EPOCH FROM (created_at - LAG(created_at) OVER (PARTITION BY session_id ORDER BY created_at))) as gap_seconds
  FROM messages
  WHERE created_at > now() - interval '1 hour'
)
SELECT 
  ROUND(AVG(gap_seconds)) as avg_gap_between_messages_sec,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY gap_seconds)) as median_gap_sec,
  COUNT(*) FILTER (WHERE gap_seconds < 1) as messages_under_1_sec_apart,
  COUNT(*) FILTER (WHERE gap_seconds < 0.5) as messages_under_half_sec_apart
FROM message_timing
WHERE gap_seconds IS NOT NULL;
```

**Interpretation:**
- `avg_gap_between_messages_sec`: Average time between messages from same user (~10-30 sec normal)
- `median_gap_sec`: Median gap (more robust)
- `messages_under_1_sec_apart`: Very fast typing or potential automation (flag if >10% of total)
- `messages_under_half_sec_apart`: Likely automation/spam (should be rare)

**Red Flags:**
- `messages_under_1_sec_apart` > 20% of total → Rate limiting not effective
- `messages_under_half_sec_apart` > 5% → Potential spam/abuse
- `avg_gap_between_messages_sec` < 5 → Unrealistic typing speed (bot activity)

**Diagnostic:**
Check edge function logs for `send-message` rate limit rejections:
```sql
-- (Via backend edge function logs viewer)
-- Filter: function = "send-message", status = 429 (rate limited)
```

---

## Abuse Detection (Run Monthly)

```sql
-- QUERY 8: Serial Blockers (Potential Trolls)
-- What it checks: Users frequently blocked by partners
-- Expected values: Most users have times_blocked = 0-1
-- 🚨 Red flags: users with times_blocked > 5 (potential repeat offenders)

SELECT 
  id as session_id,
  username,
  times_blocked,
  quick_exits,
  last_quick_exit,
  reputation_score,
  created_at
FROM guest_sessions
WHERE times_blocked > 3
  AND created_at > now() - interval '7 days'
ORDER BY times_blocked DESC
LIMIT 20;
```

**Interpretation:**
- `times_blocked`: How many partners blocked this user
- `quick_exits`: Times user ended chat in <2 minutes
- `reputation_score`: Algorithmic trust score (if implemented)
- Sessions with `times_blocked > 5` are likely trolls/harassers

**Action Items:**
- If `times_blocked > 10` → Consider IP-based temporary block (manual)
- Review `blocked_pairs` table to see who blocked them (pattern analysis)
- Check `messages` table (if still available) for content violations

**Note:** Due to ephemeral design, historical message content unavailable. Rely on community reports.

---

```sql
-- QUERY 9: Blocking Patterns (Community Health)
-- What it checks: Overall blocking frequency, trends
-- Expected values: blocking_rate < 5% of matches
-- 🚨 Red flags: blocking_rate > 10% (poor matching or harassment surge)

WITH blocking_stats AS (
  SELECT 
    DATE(bp.created_at) as block_date,
    COUNT(*) as blocks_per_day
  FROM blocked_pairs bp
  WHERE bp.created_at > now() - interval '30 days'
  GROUP BY DATE(bp.created_at)
)
SELECT 
  block_date,
  blocks_per_day,
  (SELECT COUNT(*) FROM chat_rooms WHERE DATE(created_at) = block_date) as matches_per_day,
  ROUND(blocks_per_day * 100.0 / NULLIF((SELECT COUNT(*) FROM chat_rooms WHERE DATE(created_at) = block_date), 0), 2) as blocking_rate_percent
FROM blocking_stats
ORDER BY block_date DESC
LIMIT 30;
```

**Interpretation:**
- `blocks_per_day`: Total block actions (1-50 typical depending on scale)
- `matches_per_day`: Total matches created (baseline for rate calculation)
- `blocking_rate_percent`: % of matches that resulted in block (<5% healthy)

**Red Flags:**
- `blocking_rate_percent > 10%` → Matching algorithm issues or community problem
- Sudden spike in blocks (>3x baseline) → Potential raid/harassment campaign
- `blocks_per_day` increasing trend → Platform health declining

**Diagnostic:**
- Cross-reference with external events (press coverage, social media mentions)
- Check if specific usernames/patterns repeat in `serial blockers` query
- Review survey answers/reflections for common complaints (if feedback system exists)

---

## Session Expiry Health (Run Weekly)

```sql
-- QUERY 10: Session Lifecycle Distribution
-- What it checks: How long sessions last before expiry
-- Expected values: Most sessions expire after 1-6 hours (users done chatting)
-- 🚨 Red flags: Most sessions hitting 24hr limit (possible retention attempt)

WITH session_lifetimes AS (
  SELECT 
    id,
    created_at,
    expires_at,
    EXTRACT(EPOCH FROM (expires_at - created_at)) / 3600 as lifetime_hours
  FROM guest_sessions
  WHERE expires_at < now()  -- Only expired sessions
    AND created_at > now() - interval '7 days'
)
SELECT 
  CASE 
    WHEN lifetime_hours < 1 THEN '0-1 hours'
    WHEN lifetime_hours < 6 THEN '1-6 hours'
    WHEN lifetime_hours < 12 THEN '6-12 hours'
    WHEN lifetime_hours < 24 THEN '12-24 hours'
    ELSE '24+ hours (full term)'
  END as lifetime_bucket,
  COUNT(*) as session_count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM session_lifetimes
GROUP BY lifetime_bucket
ORDER BY 
  CASE lifetime_bucket
    WHEN '0-1 hours' THEN 1
    WHEN '1-6 hours' THEN 2
    WHEN '6-12 hours' THEN 3
    WHEN '12-24 hours' THEN 4
    ELSE 5
  END;
```

**Interpretation:**
- Healthy distribution: 
  - `0-1 hours`: 20-40% (users done quickly)
  - `1-6 hours`: 30-50% (normal usage)
  - `6-12 hours`: 10-20% (extended use)
  - `12-24 hours`: 5-10% (forgot tab open)
  - `24+ hours`: 0-5% (edge cases)

**Red Flags:**
- `24+ hours` > 30% → Users trying to retain sessions (hitting limit often)
- `0-1 hours` > 70% → Users leaving immediately (poor experience)
- `12-24 hours` > 30% → Users keeping tabs open (engagement issue)

---

## Heartbeat Health (Run Daily During Issues)

```sql
-- QUERY 11: Connection Quality Indicators
-- What it checks: Heartbeat freshness, stale sessions
-- Expected values: Most heartbeats < 30 sec old, few stale
-- 🚨 Red flags: >50% of sessions have stale heartbeats (network issues)

WITH heartbeat_analysis AS (
  SELECT 
    id,
    username,
    last_heartbeat_at,
    EXTRACT(EPOCH FROM (now() - last_heartbeat_at)) as seconds_since_heartbeat,
    CASE 
      WHEN last_heartbeat_at > now() - interval '30 seconds' THEN 'fresh (<30s)'
      WHEN last_heartbeat_at > now() - interval '60 seconds' THEN 'slightly_stale (30-60s)'
      WHEN last_heartbeat_at > now() - interval '120 seconds' THEN 'stale (60-120s)'
      ELSE 'very_stale (>120s)'
    END as heartbeat_status
  FROM guest_sessions
  WHERE expires_at > now()  -- Only active sessions
)
SELECT 
  heartbeat_status,
  COUNT(*) as session_count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage,
  ROUND(AVG(seconds_since_heartbeat)) as avg_seconds_since
FROM heartbeat_analysis
GROUP BY heartbeat_status
ORDER BY 
  CASE heartbeat_status
    WHEN 'fresh (<30s)' THEN 1
    WHEN 'slightly_stale (30-60s)' THEN 2
    WHEN 'stale (60-120s)' THEN 3
    ELSE 4
  END;
```

**Interpretation:**
- `fresh (<30s)`: Currently active users (should be >70% of active sessions)
- `slightly_stale (30-60s)`: Recently active, acceptable grace period
- `stale (60-120s)`: Disconnected or backgrounded (will be cleaned up soon)
- `very_stale (>120s)`: Should be cleaned up by maintenance job

**Red Flags:**
- `fresh (<30s)` < 50% → Heartbeat system issues or network problems
- `very_stale (>120s)` > 10% → Maintenance job not running or broken
- `stale (60-120s)` > 30% → Users experiencing network issues

**Diagnostic:**
1. Check maintenance logs: `SELECT * FROM maintenance_logs ORDER BY created_at DESC LIMIT 5`
2. Test heartbeat endpoint manually (via browser console)
3. Check for Supabase region outages (external status page)

---

## Performance Baselines (Establish First Week)

**Purpose:** Run these queries daily for first week to establish "normal" values for your traffic level.

```sql
-- QUERY 12: Establish Performance Baselines
-- Run daily at same time (e.g., 2pm UTC) for 7 days
-- Record results to establish "normal" ranges

SELECT 
  now()::date as measurement_date,
  now()::time as measurement_time,
  
  -- Active State
  (SELECT COUNT(*) FROM guest_sessions WHERE expires_at > now()) as active_sessions,
  (SELECT COUNT(*) FROM chat_rooms WHERE status = 'active') as active_chats,
  (SELECT COUNT(*) FROM messages WHERE expires_at > now()) as recent_messages,
  
  -- 24-Hour Activity
  (SELECT COUNT(*) FROM guest_sessions WHERE created_at > now() - interval '24 hours') as sessions_24h,
  (SELECT COUNT(*) FROM chat_rooms WHERE created_at > now() - interval '24 hours') as matches_24h,
  (SELECT COUNT(*) FROM messages WHERE created_at > now() - interval '24 hours') as messages_24h,
  
  -- Quality Metrics
  (SELECT ROUND(AVG(EXTRACT(EPOCH FROM (last_matched_at - created_at)))) 
   FROM guest_sessions 
   WHERE last_matched_at > now() - interval '1 hour') as avg_match_time_sec,
  
  (SELECT COUNT(*) FROM blocked_pairs WHERE created_at > now() - interval '24 hours') as blocks_24h;
```

**Action:** Save results to `docs/baselines/YYYY-MM-DD.txt` for trend analysis.

---

## Summary: Red Flag Checklist

Run this mental checklist daily:

- [ ] **Matching:** Are users getting matched within 30 seconds?
- [ ] **Messages:** Are messages sending/receiving in active chats?
- [ ] **Maintenance:** Is cleanup job running every 5 minutes?
- [ ] **Heartbeats:** Are >70% of active sessions "fresh" (<30s)?
- [ ] **Engagement:** Are chats averaging >5 messages each?
- [ ] **Blocking:** Is blocking rate <5% of matches?
- [ ] **Expiry:** Are sessions expiring naturally (not all hitting 24hr limit)?

**If any red flag triggered:**
1. Re-run specific query from relevant section above
2. Check edge function logs for that component
3. Follow diagnostic steps in query interpretation
4. If issue persists >15 min → Escalate to rollback procedure (see `docs/ROLLBACK.md`)

---

## Future Enhancement: Automated Monitoring

**When traffic scales (>1000 daily users), migrate to:**
- Automated query execution (cron job + alerting)
- Metrics dashboard (Grafana or similar)
- Real-time anomaly detection (via `maintenance_logs` telemetry)

**See:** Phase 4: Monitoring Automation (post-launch roadmap)

---

**Document Version:** 1.0  
**Review Schedule:** Monthly or post-incident  
**Owner:** Engineering Team
