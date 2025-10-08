/**
 * Centralized validation utilities
 */

/**
 * Validates UUID format (v1-v5)
 * Matches format: 8-4-4-4-12 hexadecimal characters
 */
export const isUuid = (value: string): boolean => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
};
