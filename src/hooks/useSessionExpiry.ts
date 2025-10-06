import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

/**
 * Monitors session expiry and redirects to home when session expires
 */
export function useSessionExpiry(expiresAt: string | null) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!expiresAt) return;

    const expiryTime = new Date(expiresAt).getTime();
    const now = Date.now();
    const timeUntilExpiry = expiryTime - now;

    // If already expired, redirect immediately
    if (timeUntilExpiry <= 0) {
      toast.error("Your session has expired");
      localStorage.removeItem("conversely_session");
      navigate("/", { replace: true });
      return;
    }

    // Set timeout to handle expiry
    const expiryTimeout = setTimeout(() => {
      toast.error("Your session has expired");
      localStorage.removeItem("conversely_session");
      navigate("/", { replace: true });
    }, timeUntilExpiry);

    // Warn 2 minutes before expiry
    const warningTime = timeUntilExpiry - 2 * 60 * 1000;
    const warningTimeout = warningTime > 0 
      ? setTimeout(() => {
          toast.warning("Your session will expire in 2 minutes");
        }, warningTime)
      : null;

    return () => {
      clearTimeout(expiryTimeout);
      if (warningTimeout) clearTimeout(warningTimeout);
    };
  }, [expiresAt, navigate]);
}
