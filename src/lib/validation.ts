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

  if (sanitized.length > 500) {
    return { valid: false, error: 'Message is too long (max 500 characters)' };
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
 * Validate feedback content (for reflection)
 */
export function validateFeedback(feedback: string): ValidationResult {
  if (!feedback) {
    return { valid: true }; // Feedback is optional
  }

  if (typeof feedback !== 'string') {
    return { valid: false, error: 'Invalid feedback format' };
  }

  const sanitized = sanitizeText(feedback);
  
  // If providing feedback, require minimum length
  if (sanitized.length > 0 && sanitized.length < 10) {
    return { valid: false, error: 'Feedback must be at least 10 characters' };
  }
  
  if (sanitized.length > 1000) {
    return { valid: false, error: 'Feedback is too long (max 1000 characters)' };
  }

  if (containsHTML(sanitized)) {
    return { valid: false, error: 'Feedback contains HTML tags' };
  }

  if (containsBlockedContent(sanitized)) {
    return { valid: false, error: 'Feedback contains inappropriate content' };
  }

  return { valid: true };
}
