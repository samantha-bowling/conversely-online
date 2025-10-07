import { LEGAL_VERSION, TOS_HASH, PRIVACY_HASH, hasLegalChanged } from '@/config/legal';

export interface LegalAcceptance {
  version: string;
  tosHash: string;
  privacyHash: string;
  acceptedAt: string; // ISO timestamp
  country: string;
  ageConfirmed: boolean;
}

const STORAGE_KEY = 'conversely_legal_acceptance';
const AGE_GATE_KEY = 'conversely_age_gate_shown';

/**
 * Get stored legal acceptance data
 */
export const getAcceptance = (): LegalAcceptance | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as LegalAcceptance;
  } catch {
    return null;
  }
};

/**
 * Check if current acceptance is up-to-date
 */
export const isAcceptanceCurrent = (): boolean => {
  const acceptance = getAcceptance();
  if (!acceptance) return false;

  return !hasLegalChanged(acceptance.version, acceptance.tosHash, acceptance.privacyHash);
};

/**
 * Record legal acceptance
 */
export const recordAcceptance = (country: string): void => {
  const acceptance: LegalAcceptance = {
    version: LEGAL_VERSION,
    tosHash: TOS_HASH,
    privacyHash: PRIVACY_HASH,
    acceptedAt: new Date().toISOString(),
    country,
    ageConfirmed: true,
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(acceptance));
};

/**
 * Check if user needs to re-accept legal documents
 */
export const needsReAcceptance = (): boolean => {
  const acceptance = getAcceptance();
  if (!acceptance) return true; // Never accepted

  return hasLegalChanged(acceptance.version, acceptance.tosHash, acceptance.privacyHash);
};

/**
 * Check if age gate has been shown to user
 */
export const hasSeenAgeGate = (): boolean => {
  return localStorage.getItem(AGE_GATE_KEY) === 'true';
};

/**
 * Mark age gate as shown
 */
export const markAgeGateSeen = (): void => {
  localStorage.setItem(AGE_GATE_KEY, 'true');
};

/**
 * Clear all legal acceptance data (for testing/reset)
 */
export const clearAcceptance = (): void => {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(AGE_GATE_KEY);
};
