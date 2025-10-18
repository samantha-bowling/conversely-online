const GRACE_WINDOW_MS = 60 * 1000; // 60 seconds - matches useSessionExpiry

/**
 * Check if a session expiry timestamp is within the grace period
 * Grace period: 60 seconds after expiry
 */
export function isWithinGracePeriod(expiresAt: string): boolean {
  const expiryTime = new Date(expiresAt).getTime();
  const now = Date.now();
  const timeSinceExpiry = now - expiryTime;
  
  return timeSinceExpiry > 0 && timeSinceExpiry <= GRACE_WINDOW_MS;
}

/**
 * Get stored session from localStorage
 */
export function getStoredSession(): { expires_at: string } | null {
  try {
    const stored = localStorage.getItem('guest_session');
    if (!stored) return null;
    return JSON.parse(stored);
  } catch {
    return null;
  }
}
