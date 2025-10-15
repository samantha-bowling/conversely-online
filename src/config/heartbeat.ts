// Centralized heartbeat configuration for ghost account prevention
// 
// GHOST ACCOUNT PROTECTION ARCHITECTURE:
// - Client heartbeats: Every 15s
// - Matching window: 15s + 2s drift (allows 1 missed beat + clock skew)
// - Max ghost visibility: ~32s total (15s last beat + 15s timeout + 2s drift)
// - Activity counts: Only include sessions with heartbeat < 17s old

/**
 * Client sends heartbeat every 15 seconds
 * Used in: Matching.tsx, Chat.tsx
 * Note: Continues in background tabs (only stops when truly offline)
 */
export const HEARTBEAT_INTERVAL_MS = 15000;

/**
 * Matching requires heartbeat within 15 seconds
 * Used in: match-opposite edge function
 */
export const MATCH_HEARTBEAT_TTL_MS = 15000;

/**
 * Chat allows 30 second grace period for disconnect detection
 * Used in: check_partner_heartbeat DB function
 */
export const CHAT_HEARTBEAT_TTL_MS = 30000;

/**
 * Activity counts require 15 second freshness
 * Used in: get-activity-level edge function
 */
export const ACTIVITY_HEARTBEAT_TTL_MS = 15000;

/**
 * Clock drift/network delay buffer (prevents borderline rejections)
 * Added to TTL checks to handle minor client clock skew
 */
export const HEARTBEAT_DRIFT_MS = 2000;
