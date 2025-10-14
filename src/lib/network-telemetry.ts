/**
 * Network telemetry and logging
 * 
 * Provides a minimal, pluggable interface for network event logging.
 * Currently logs to console in DEV mode.
 * Future: integrate with Sentry, Supabase analytics, etc.
 */

export type NetworkEvent = 
  | "offline" 
  | "online" 
  | "reconnecting" 
  | "reconnected"
  | "degraded";

export const logNetworkEvent = (
  event: NetworkEvent,
  meta?: Record<string, any>
): void => {
  if (import.meta.env.DEV) {
    console.info(`[Network] ${event}`, meta || {});
  }
  
  // Future: Send to external monitoring service
  // Example:
  // if (import.meta.env.PROD) {
  //   Sentry.captureMessage(`Network: ${event}`, {
  //     level: 'info',
  //     extra: meta,
  //   });
  // }
};
