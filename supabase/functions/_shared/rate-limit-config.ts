/**
 * Rate Limiting Configuration
 * 
 * Centralized constants for match request rate limiting.
 * Adjust these values to balance UX vs. abuse prevention.
 */

export const RATE_LIMIT_CONFIG = {
  // Maximum number of match requests allowed within the time window
  MAX_REQUESTS: 10,
  
  // Time window in milliseconds (2 minutes)
  WINDOW_MS: 120000,
  
  // Human-readable description for logs/debugging
  DESCRIPTION: '10 requests per 2 minutes'
} as const;
