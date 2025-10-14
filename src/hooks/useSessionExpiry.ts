import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";

const GRACE_WINDOW_MS = 60 * 1000; // 60 seconds grace window

/**
 * Monitors session expiry and redirects to session expired page
 * Includes a 60-second grace window for immediate returns after expiry
 */
export function useSessionExpiry(expiresAt: string | null) {
  const navigate = useNavigate();
  const location = useLocation();
  const graceExpiryRef = useRef<number | null>(null);

  useEffect(() => {
    if (!expiresAt) return;

    const expiryTime = new Date(expiresAt).getTime();
    const now = Date.now();
    const timeUntilExpiry = expiryTime - now;

    // Check if within grace window
    if (timeUntilExpiry <= 0) {
      const graceExpiry = graceExpiryRef.current || expiryTime + GRACE_WINDOW_MS;
      graceExpiryRef.current = graceExpiry;

      const timeUntilGraceExpiry = graceExpiry - now;

      if (timeUntilGraceExpiry <= 0) {
        // Grace window expired - redirect to session expired page
        const context = {
          wasInChat: location.pathname.includes('/chat'),
          wasMatching: location.pathname === '/matching',
          timestamp: Date.now()
        };
        
        navigate("/session-expired", { state: context, replace: true });
        
        // Clear localStorage after navigation
        setTimeout(() => {
          localStorage.removeItem("guest_session");
        }, 100);
        return;
      } else {
        // Still within grace window - set timeout for grace expiry
        const graceTimeout = setTimeout(() => {
          const context = {
            wasInChat: location.pathname.includes('/chat'),
            wasMatching: location.pathname === '/matching',
            timestamp: Date.now()
          };
          
          navigate("/session-expired", { state: context, replace: true });
          
          setTimeout(() => {
            localStorage.removeItem("guest_session");
          }, 100);
        }, timeUntilGraceExpiry);

        return () => clearTimeout(graceTimeout);
      }
    }

    // Reset grace window reference if session is still valid
    graceExpiryRef.current = null;

    // Set timeout to handle expiry
    const expiryTimeout = setTimeout(() => {
      graceExpiryRef.current = Date.now() + GRACE_WINDOW_MS;
      
      const context = {
        wasInChat: location.pathname.includes('/chat'),
        wasMatching: location.pathname === '/matching',
        timestamp: Date.now()
      };
      
      navigate("/session-expired", { state: context, replace: true });
      
      setTimeout(() => {
        localStorage.removeItem("guest_session");
      }, 100);
    }, timeUntilExpiry);

    return () => {
      clearTimeout(expiryTimeout);
    };
  }, [expiresAt, navigate, location.pathname]);
}
