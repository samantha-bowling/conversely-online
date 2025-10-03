import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

// Rate limiting store (in-memory with TTL)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// Blocked content patterns
export const BLOCKED_PATTERNS = [
  // Profanity and offensive content
  /\b(fuck|shit|bitch|asshole|bastard|damn|cunt|dick|pussy|cock)\b/gi,
  /\b(nigger|nigga|faggot|retard|spic|chink|kike)\b/gi,
  
  // Personal information
  /\b\d{10,}\b/g, // Phone numbers (10+ digits)
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email addresses
  
  // Social media handles
  /@\w+/g,
  
  // URLs
  /https?:\/\/[^\s]+/gi,
  /www\.[^\s]+/gi,
  
  // Extreme content
  /\b(kill|murder|suicide|die|death|harm|hurt|attack|bomb|shoot|stab)\s+(you|yourself|me|them|him|her)\b/gi,
];

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface SessionData {
  id: string;
  username: string;
  avatar: string;
  expires_at: string;
}

/**
 * Validate a guest session
 */
export async function validateSession(
  supabase: any,
  sessionId: string
): Promise<{ valid: boolean; session?: SessionData; error?: string }> {
  if (!sessionId || typeof sessionId !== 'string') {
    return { valid: false, error: 'Invalid session ID format' };
  }

  try {
    const { data: session, error } = await supabase
      .from('guest_sessions')
      .select('id, username, avatar, expires_at')
      .eq('id', sessionId)
      .single();

    if (error || !session) {
      return { valid: false, error: 'Session not found' };
    }

    // Check if expired
    if (new Date((session as SessionData).expires_at) <= new Date()) {
      return { valid: false, error: 'Session expired' };
    }

    return { valid: true, session: session as SessionData };
  } catch (error) {
    console.error('Session validation error:', error);
    return { valid: false, error: 'Session validation failed' };
  }
}

/**
 * Validate message content
 */
export function validateMessageContent(content: string): ValidationResult {
  if (!content || typeof content !== 'string') {
    return { valid: false, error: 'Message content is required' };
  }

  // Trim and check length
  const trimmed = content.trim();
  
  if (trimmed.length === 0) {
    return { valid: false, error: 'Message cannot be empty' };
  }

  if (trimmed.length > 500) {
    return { valid: false, error: 'Message too long (max 500 characters)' };
  }

  // Check for blocked patterns
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { valid: false, error: 'Message contains inappropriate content' };
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
 * Verify user is participant in room
 */
export async function verifyRoomParticipant(
  supabase: any,
  roomId: string,
  sessionId: string
): Promise<{ valid: boolean; error?: string }> {
  if (!roomId || !sessionId) {
    return { valid: false, error: 'Missing room or session ID' };
  }

  try {
    const { data: room, error } = await supabase
      .from('chat_rooms')
      .select('session_a, session_b, status')
      .eq('id', roomId)
      .single();

    if (error || !room) {
      return { valid: false, error: 'Room not found' };
    }

    const roomData = room as { session_a: string; session_b: string; status: string };
    const isParticipant = roomData.session_a === sessionId || roomData.session_b === sessionId;
    
    if (!isParticipant) {
      return { valid: false, error: 'Not a participant in this room' };
    }

    return { valid: true };
  } catch (error) {
    console.error('Room verification error:', error);
    return { valid: false, error: 'Room verification failed' };
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
    return { valid: false, error: 'Invalid feedback format' };
  }

  const trimmed = feedback.trim();
  
  if (trimmed.length > 1000) {
    return { valid: false, error: 'Feedback too long (max 1000 characters)' };
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
    return { valid: false, error: 'Rating must be an integer between 1 and 5' };
  }

  return { valid: true };
}
