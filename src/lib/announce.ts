/**
 * Debounced screen reader announcement utility
 * Prevents timing issues with VoiceOver/NVDA during re-renders
 */
export function announce(message: string, priority: 'polite' | 'assertive' = 'polite') {
  const announcerId = `sr-announcer-${priority}`;
  const el = document.getElementById(announcerId);
  
  if (!el) {
    console.warn(`[SR Announce] Announcer element #${announcerId} not found`);
    return;
  }

  // Clear existing message
  el.textContent = '';
  
  // Add new message after brief delay (ensures SR picks it up)
  setTimeout(() => {
    el.textContent = message;
  }, 100);
}
