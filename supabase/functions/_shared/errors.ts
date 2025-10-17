/**
 * Standardized API Error Schema
 * Provides type-safe, consistent error responses across all edge functions
 */

export interface ApiError {
  error: string;
  code?: string;
  details?: string;
}

// Session & Authentication Errors
export const SESSION_EXPIRED_ERROR: ApiError = {
  error: 'Session expired',
  code: 'SESSION_EXPIRED',
};

export const INVALID_JWT_ERROR: ApiError = {
  error: 'Invalid or expired authentication token',
  code: 'INVALID_JWT',
};

export const UNAUTHORIZED_ERROR: ApiError = {
  error: 'Unauthorized - missing auth token',
  code: 'UNAUTHORIZED',
};

export const SESSION_NOT_FOUND_ERROR: ApiError = {
  error: 'Session not found',
  code: 'SESSION_NOT_FOUND',
};

// Rate Limiting Errors
export const RATE_LIMIT_ERROR: ApiError = {
  error: 'Rate limit exceeded',
  code: 'RATE_LIMIT_EXCEEDED',
};

// Validation Errors
export const INVALID_INPUT_ERROR: ApiError = {
  error: 'Invalid input provided',
  code: 'INVALID_INPUT',
};

export const REQUEST_TOO_LARGE_ERROR: ApiError = {
  error: 'Request too large',
  code: 'REQUEST_TOO_LARGE',
};

// Business Logic Errors
export const ROOM_NOT_FOUND_ERROR: ApiError = {
  error: 'Chat room not found or access denied',
  code: 'ROOM_NOT_FOUND',
};

export const ROOM_INACTIVE_ERROR: ApiError = {
  error: 'Chat room is no longer active',
  code: 'ROOM_INACTIVE',
};

export const DUPLICATE_SUBMISSION_ERROR: ApiError = {
  error: 'Duplicate submission detected',
  code: 'DUPLICATE_SUBMISSION',
};

// Server Errors
export const INTERNAL_SERVER_ERROR: ApiError = {
  error: 'Internal server error',
  code: 'INTERNAL_ERROR',
};

/**
 * Helper to create custom error with consistent schema
 */
export function createError(message: string, code?: string, details?: string): ApiError {
  return {
    error: message,
    code,
    details,
  };
}
