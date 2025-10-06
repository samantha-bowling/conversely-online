/**
 * Client-side validation utilities
 * These mirror the server-side validation for better UX
 */

// Leetspeak normalization map
const LEET_MAP: Record<string, string> = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b',
  '@': 'a', '$': 's', '!': 'i', '+': 't', '€': 'e'
};

/**
 * Normalize text for content detection
 * Removes spaces, converts leetspeak, normalizes unicode
 */
export function normalizeForDetection(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, '') // Remove all whitespace
    .replace(/[01345678@$!+€]/g, (char) => LEET_MAP[char] || char) // Convert leetspeak
    .normalize('NFKD') // Normalize unicode variants
    .replace(/[\u0300-\u036f]/g, ''); // Remove diacritics
}

// Blocked content patterns (subset of server-side patterns for performance)
const BLOCKED_PATTERNS = [
  // Profanity and offensive content (including masked versions)
  /\b(fuck|shit|bitch|asshole|bastard|cunt|dick|pussy|cock)\b/gi,
  /\b(f[\*\.@#$]ck|sh[\*\.@#$]t|b[\*\.@#$]tch)\b/gi, // Masked profanity
  /\b(nigger|nigga|faggot|retard|spic|chink|kike)\b/gi,
  
  // Sexual content and solicitation
  /\b(send\s*(me\s*)?(nudes?|pics?|photos?))\b/gi,
  /\b(dick\s*pic|nude\s*pic|sexy\s*pic)\b/gi,
  /\b(want\s*to\s*(fuck|hook\s*up|bang))\b/gi,
  
  // Social media solicitation
  /\b(add\s*me\s*on|find\s*me\s*on|follow\s*me)\s*(snap|insta|kik|telegram|discord|whatsapp)/gi,
  /\b(snapchat|instagram|kik|telegram)\s*(:|\s+is\s+|@)/gi,
  
  // Personal information
  /\b(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  
  // URLs
  /https?:\/\/[^\s]+/gi,
  /www\.[^\s]+/gi,
  /\b\w+\.(com|net|org|io|co)\b/gi, // Domain names
  
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

  // Check for blocked content (normalized)
  const normalized = normalizeForDetection(sanitized);
  if (containsBlockedContent(sanitized) || containsBlockedContent(normalized)) {
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
