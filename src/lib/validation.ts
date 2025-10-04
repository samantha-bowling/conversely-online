/**
 * Client-side validation utilities
 * These mirror the server-side validation for better UX
 */

// Blocked content patterns (subset of server-side patterns for performance)
const BLOCKED_PATTERNS = [
  // Profanity and offensive content
  /\b(fuck|shit|bitch|asshole|bastard|cunt|dick|pussy|cock)\b/gi,
  /\b(nigger|nigga|faggot|retard|spic|chink|kike)\b/gi,
  
  // Personal information
  /\b(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  
  // URLs
  /https?:\/\/[^\s]+/gi,
  /www\.[^\s]+/gi,
  
  // Extreme content
  /\b(kill|murder|suicide|die|death|harm|hurt|attack|bomb|shoot|stab)\s+(you|yourself|me|them|him|her)\b/gi,
  
  // HTML/Script tags
  /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
  /<iframe[\s\S]*?>/gi,
  
  // Excessive repetition
  /(.)\1{9,}/g,
  /\b(\w+)\s+\1\s+\1/gi,
];

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Sanitize text input
 */
export function sanitizeText(text: string): string {
  return text
    .trim()
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width chars
    .normalize('NFC');
}

/**
 * Check if text contains HTML tags
 */
export function containsHTML(text: string): boolean {
  return /<[^>]*>/g.test(text);
}

/**
 * Check for blocked content patterns
 */
export function containsBlockedContent(text: string): boolean {
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }
  return false;
}

/**
 * Validate message content (for chat)
 */
export function validateMessage(content: string): ValidationResult {
  if (!content || typeof content !== 'string') {
    return { valid: false, error: 'Message is required' };
  }

  const sanitized = sanitizeText(content);
  
  if (sanitized.length === 0) {
    return { valid: false, error: 'Message cannot be empty' };
  }

  if (sanitized.length > VALIDATION.MAX_MESSAGE_LENGTH) {
    return { valid: false, error: `Message is too long (max ${VALIDATION.MAX_MESSAGE_LENGTH} characters)` };
  }

  if (containsHTML(sanitized)) {
    return { valid: false, error: 'Message contains HTML tags' };
  }

  if (containsBlockedContent(sanitized)) {
    return { valid: false, error: 'Message contains inappropriate content' };
  }

  return { valid: true };
}

/**
 * Type guards for runtime validation
 */
import type { ChatLocationState, MatchOppositeResponse, GetRoomDataResponse } from '@/types';
import { VALIDATION } from '@/config/constants';

export function isValidLocationState(state: unknown): state is ChatLocationState {
  return (
    typeof state === 'object' &&
    state !== null &&
    'room_id' in state &&
    typeof (state as any).room_id === 'string' &&
    (state as any).room_id.length > 0
  );
}

export function isMatchResponse(data: unknown): data is MatchOppositeResponse {
  if (typeof data !== 'object' || data === null) return false;
  const response = data as any;
  return (
    typeof response.status === 'string' &&
    ['match_found', 'no_match', 'cooldown', 'rate_limited'].includes(response.status)
  );
}

export function isRoomDataResponse(data: unknown): data is GetRoomDataResponse {
  if (typeof data !== 'object' || data === null) return false;
  const response = data as any;
  return (
    typeof response.status === 'string' &&
    ['active', 'ended'].includes(response.status) &&
    typeof response.partner_id === 'string'
  );
}
