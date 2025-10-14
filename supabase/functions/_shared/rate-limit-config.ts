/**
 * Rate Limiting Configuration
 * 
 * Centralized constants for all edge function rate limiting.
 * Adjust these values to balance UX vs. abuse prevention.
 */

export interface RateLimitDefinition {
  MAX_REQUESTS: number;
  WINDOW_MS: number;
  DESCRIPTION: string;
  SCOPE: string;
}

export const RATE_LIMIT_CONFIG = {
  // Matching requests (user-initiated)
  MATCH_OPPOSITE: {
    MAX_REQUESTS: 10,
    WINDOW_MS: 120000, // 2 minutes
    DESCRIPTION: '10 requests per 2 minutes',
    SCOPE: 'user_id'
  },
  
  // Session creation (IP-based)
  CREATE_SESSION: {
    MAX_REQUESTS: 10,
    WINDOW_MS: 3600000, // 1 hour
    DESCRIPTION: '10 sessions per hour per IP',
    SCOPE: 'client_ip'
  },
  
  // Message sending (per session)
  SEND_MESSAGE: {
    MAX_REQUESTS: 60,
    WINDOW_MS: 60000, // 1 minute
    DESCRIPTION: '60 messages per minute',
    SCOPE: 'session_id'
  },
  
  // Chat ending (per session)
  END_CHAT: {
    MAX_REQUESTS: 10,
    WINDOW_MS: 600000, // 10 minutes
    DESCRIPTION: '10 end-chat calls per 10 minutes',
    SCOPE: 'session_id'
  },
  
  // User blocking (per session)
  BLOCK_USER: {
    MAX_REQUESTS: 3,
    WINDOW_MS: 3600000, // 1 hour
    DESCRIPTION: '3 blocks per hour',
    SCOPE: 'session_id'
  },
  
  // Reflection submission (per user)
  SUBMIT_REFLECTION: {
    MAX_REQUESTS: 10,
    WINDOW_MS: 600000, // 10 minutes
    DESCRIPTION: '10 reflections per 10 minutes',
    SCOPE: 'user_id'
  },
  
  // Survey submission (per session)
  SUBMIT_SURVEY: {
    MAX_REQUESTS: 3,
    WINDOW_MS: 600000, // 10 minutes
    DESCRIPTION: '3 surveys per 10 minutes',
    SCOPE: 'session_id'
  },
  
  // Fallback global cap for undefined functions
  DEFAULT: {
    MAX_REQUESTS: 100,
    WINDOW_MS: 60000, // 1 minute
    DESCRIPTION: 'Default: 100 requests per minute',
    SCOPE: 'generic'
  }
} as const satisfies Record<string, RateLimitDefinition>;
