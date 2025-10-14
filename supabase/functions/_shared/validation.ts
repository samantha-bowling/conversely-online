import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

// Rate limiting store (in-memory with TTL)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

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

// Blocked content patterns
export const BLOCKED_PATTERNS = [
  // Profanity and offensive content (including masked versions)
  /\b(fuck|shit|bitch|asshole|bastard|damn|cunt|dick|pussy|cock)\b/gi,
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
  /\b(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, // Phone numbers
  /\b(\+?\d{1,3}[-.\s]?)?\d{10,}\b/g, // International
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email
  
  // Social media handles
  /@[\w]{3,}/g,
  
  // URLs
  /https?:\/\/[^\s]+/gi,
  /www\.[^\s]+/gi,
  /\b\w+\.(com|net|org|io|co)\b/gi, // Domain names
  
  // Crypto spam
  /\b(bitcoin|btc|eth|crypto|nft|invest|profit|money)\s+(now|today|dm|quick)/gi,
  
  // Extreme content
  /\b(kill|murder|suicide|die|death|harm|hurt|attack|bomb|shoot|stab)\s+(you|yourself|me|them|him|her)\b/gi,
  
  // HTML/Script tags (XSS prevention)
  /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
  /<iframe[\s\S]*?>/gi,
  /<object[\s\S]*?>/gi,
  /<embed[\s\S]*?>/gi,
  
  // Excessive repetition (spam detection)
  /(.)\1{9,}/g, // Same character repeated 10+ times
  /\b(\w+)\s+\1\s+\1/gi, // Same word repeated 3+ times
  
  // Excessive emojis (5+ in a row)
  /[\u{1F300}-\u{1F9FF}]{5,}/gu,
  
  // Zero-width characters (invisible spam)
  /[\u200B-\u200D\uFEFF]/g,
];

export interface ValidationResult {
  valid: boolean;
  error?: string;
  code?: string;
}

export interface SessionData {
  id: string;
  username: string;
  avatar: string;
  expires_at: string;
}

// UUID validation regex (supports v1-v5)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Reserved usernames
const RESERVED_USERNAMES = new Set([
  'admin', 'system', 'moderator', 'support', 'conversely', 'conv', 'root', 'null', 'undefined',
  'guest', 'user', 'test', 'demo', 'bot', 'official'
]);

/**
 * Validate UUID format
 */
export function validateUUID(value: string, fieldName: string = 'ID'): ValidationResult {
  if (!value || typeof value !== 'string') {
    return { valid: false, error: `${fieldName} is required`, code: 'INVALID_UUID_FORMAT' };
  }
  
  if (!UUID_REGEX.test(value)) {
    return { valid: false, error: `Invalid ${fieldName} format`, code: 'INVALID_UUID_FORMAT' };
  }
  
  return { valid: true };
}

/**
 * Sanitize text input
 */
export function sanitizeText(text: string): string {
  return text
    .trim()
    // Remove zero-width characters
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    // Normalize unicode
    .normalize('NFC')
    // Remove control characters
    .replace(/[\x00-\x1F\x7F]/g, '');
}

/**
 * Check if text contains HTML tags
 */
export function containsHTML(text: string): boolean {
  return /<[^>]*>/g.test(text);
}

/**
 * Validate username
 */
export function validateUsername(username: string): ValidationResult {
  if (!username || typeof username !== 'string') {
    return { valid: false, error: 'Username is required', code: 'USERNAME_REQUIRED' };
  }

  const sanitized = sanitizeText(username);
  
  if (sanitized.length < 3) {
    return { valid: false, error: 'Username must be at least 3 characters', code: 'USERNAME_TOO_SHORT' };
  }
  
  if (sanitized.length > 30) {
    return { valid: false, error: 'Username must be less than 30 characters', code: 'USERNAME_TOO_LONG' };
  }
  
  // Allow alphanumeric, spaces, hyphens, underscores
  if (!/^[a-zA-Z0-9\s\-_]+$/.test(sanitized)) {
    return { valid: false, error: 'Username contains invalid characters', code: 'USERNAME_INVALID_CHARS' };
  }
  
  // Check if reserved
  if (RESERVED_USERNAMES.has(sanitized.toLowerCase())) {
    return { valid: false, error: 'Username is reserved', code: 'USERNAME_RESERVED' };
  }
  
  // Check for blocked content
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(sanitized)) {
      return { valid: false, error: 'Username contains inappropriate content', code: 'USERNAME_BLOCKED_CONTENT' };
    }
  }
  
  return { valid: true };
}

/**
 * Validate request body structure
 */
export function validateRequestBody(
  body: any,
  requiredFields: string[],
  optionalFields: string[] = []
): ValidationResult {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Invalid request body', code: 'INVALID_BODY' };
  }
  
  // Check required fields
  for (const field of requiredFields) {
    if (!(field in body) || body[field] === null || body[field] === undefined) {
      return { valid: false, error: `Missing required field: ${field}`, code: 'MISSING_FIELD' };
    }
  }
  
  // Check for unexpected fields
  const allowedFields = new Set([...requiredFields, ...optionalFields]);
  for (const field of Object.keys(body)) {
    if (!allowedFields.has(field)) {
      return { valid: false, error: `Unexpected field: ${field}`, code: 'UNEXPECTED_FIELD' };
    }
  }
  
  return { valid: true };
}

/**
 * Validate a guest session
 */
export async function validateSession(
  supabase: any,
  sessionId: string
): Promise<{ valid: boolean; session?: SessionData; error?: string; code?: string }> {
  // Validate UUID format first
  const uuidCheck = validateUUID(sessionId, 'Session ID');
  if (!uuidCheck.valid) {
    return { valid: false, error: uuidCheck.error, code: uuidCheck.code };
  }

  try {
    const { data: session, error } = await supabase
      .from('guest_sessions')
      .select('id, username, avatar, expires_at')
      .eq('id', sessionId)
      .single();

    if (error || !session) {
      return { valid: false, error: 'Session not found', code: 'SESSION_NOT_FOUND' };
    }

    // Check if expired
    if (new Date((session as SessionData).expires_at) <= new Date()) {
      return { valid: false, error: 'Session expired', code: 'SESSION_EXPIRED' };
    }

    return { valid: true, session: session as SessionData };
  } catch (error) {
    console.error('Session validation error:', error);
    return { valid: false, error: 'Session validation failed', code: 'SESSION_VALIDATION_ERROR' };
  }
}

/**
 * Validate message content
 */
export function validateMessageContent(content: string): ValidationResult {
  if (!content || typeof content !== 'string') {
    return { valid: false, error: 'Message content is required', code: 'MESSAGE_REQUIRED' };
  }

  // Sanitize and check length
  const sanitized = sanitizeText(content);
  
  if (sanitized.length === 0) {
    return { valid: false, error: 'Message cannot be empty', code: 'MESSAGE_EMPTY' };
  }

  if (sanitized.length > 500) {
    return { valid: false, error: 'Message too long (max 500 characters)', code: 'MESSAGE_TOO_LONG' };
  }

  // Check for HTML content
  if (containsHTML(sanitized)) {
    return { valid: false, error: 'Message contains HTML content', code: 'MESSAGE_HTML_DETECTED' };
  }

  // Check for blocked patterns (normalized)
  const normalized = normalizeForDetection(sanitized);
  for (const pattern of BLOCKED_PATTERNS) {
    // Test both original and normalized for better detection
    if (pattern.test(sanitized) || pattern.test(normalized)) {
      return { valid: false, error: 'Message contains inappropriate content', code: 'MESSAGE_BLOCKED_CONTENT' };
    }
  }

  return { valid: true };
}

/**
 * Check rate limit
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const record = rateLimitStore.get(key);

  // Clean up expired entries periodically
  if (Math.random() < 0.01) {
    for (const [k, v] of rateLimitStore.entries()) {
      if (v.resetAt < now) {
        rateLimitStore.delete(k);
      }
    }
  }

  if (!record || record.resetAt < now) {
    // New window
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return { allowed: true };
  }

  if (record.count >= maxRequests) {
    const retryAfter = Math.ceil((record.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }

  // Increment count
  record.count++;
  return { allowed: true };
}

/**
 * Standardized rate limit logging with structured output
 * Provides consistent log format across all edge functions
 */
export function logRateLimit(
  functionName: string,
  identifier: string,
  retryAfter: number
): void {
  const logData = {
    level: 'warn',
    type: 'rate_limit',
    function: functionName,
    identifier,
    retryAfter,
    timestamp: new Date().toISOString()
  };
  console.warn(`[RateLimit] ${functionName}: ${identifier} exceeded limit (retry in ${retryAfter}s)`, logData);
}

/**
 * Extract client IP address from request headers
 * Supports multiple CDN/proxy headers with graceful fallback
 */
export function extractClientIp(req: Request): string {
  // Check headers in order of preference
  const xForwardedFor = req.headers.get('x-forwarded-for');
  if (xForwardedFor) {
    // x-forwarded-for can be comma-separated list, take first
    return xForwardedFor.split(',')[0].trim();
  }
  
  const cfConnectingIp = req.headers.get('cf-connecting-ip');
  if (cfConnectingIp) return cfConnectingIp;
  
  const xRealIp = req.headers.get('x-real-ip');
  if (xRealIp) return xRealIp;
  
  const flyClientIp = req.headers.get('fly-client-ip');
  if (flyClientIp) return flyClientIp;
  
  // Graceful fallback
  return 'unknown';
}

/**
 * Verify user is participant in room
 */
export async function verifyRoomParticipant(
  supabase: any,
  roomId: string,
  sessionId: string
): Promise<{ valid: boolean; error?: string; code?: string }> {
  // Validate UUID formats first
  const roomIdCheck = validateUUID(roomId, 'Room ID');
  if (!roomIdCheck.valid) {
    return { valid: false, error: roomIdCheck.error, code: roomIdCheck.code };
  }
  
  const sessionIdCheck = validateUUID(sessionId, 'Session ID');
  if (!sessionIdCheck.valid) {
    return { valid: false, error: sessionIdCheck.error, code: sessionIdCheck.code };
  }

  try {
    const { data: room, error } = await supabase
      .from('chat_rooms')
      .select('session_a, session_b, status')
      .eq('id', roomId)
      .single();

    if (error || !room) {
      return { valid: false, error: 'Room not found', code: 'ROOM_NOT_FOUND' };
    }

    const roomData = room as { session_a: string; session_b: string; status: string };
    const isParticipant = roomData.session_a === sessionId || roomData.session_b === sessionId;
    
    if (!isParticipant) {
      return { valid: false, error: 'Not a participant in this room', code: 'NOT_ROOM_PARTICIPANT' };
    }

    return { valid: true };
  } catch (error) {
    console.error('Room verification error:', error);
    return { valid: false, error: 'Room verification failed', code: 'ROOM_VERIFICATION_ERROR' };
  }
}

/**
 * Validate feedback content
 */
export function validateFeedback(feedback: string | null): ValidationResult {
  if (feedback === null || feedback === undefined) {
    return { valid: true };
  }

  if (typeof feedback !== 'string') {
    return { valid: false, error: 'Invalid feedback format', code: 'FEEDBACK_INVALID_TYPE' };
  }

  const sanitized = sanitizeText(feedback);
  
  // If providing feedback, require minimum length
  if (sanitized.length > 0 && sanitized.length < 10) {
    return { valid: false, error: 'Feedback must be at least 10 characters', code: 'FEEDBACK_TOO_SHORT' };
  }
  
  if (sanitized.length > 1000) {
    return { valid: false, error: 'Feedback too long (max 1000 characters)', code: 'FEEDBACK_TOO_LONG' };
  }

  // Check for HTML content
  if (containsHTML(sanitized)) {
    return { valid: false, error: 'Feedback contains HTML content', code: 'FEEDBACK_HTML_DETECTED' };
  }

  // Check for blocked patterns
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(sanitized)) {
      return { valid: false, error: 'Feedback contains inappropriate content', code: 'FEEDBACK_BLOCKED_CONTENT' };
    }
  }

  return { valid: true };
}

/**
 * Validate rating
 */
export function validateRating(rating: number | null): ValidationResult {
  if (rating === null || rating === undefined) {
    return { valid: true };
  }

  if (typeof rating !== 'number' || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
    return { valid: false, error: 'Rating must be an integer between 1 and 5', code: 'RATING_INVALID' };
  }

  return { valid: true };
}
