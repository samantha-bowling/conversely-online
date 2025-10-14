import { useState, useEffect, useRef } from "react";
import { logNetworkEvent } from "@/lib/network-telemetry";

export type NetworkQuality = "high" | "medium" | "low" | "offline";
export type NetworkStatus = "online" | "offline" | "degraded";

interface NetworkStatusReturn {
  isOnline: boolean;
  isVisible: boolean;
  networkStatus: NetworkStatus;
  quality: NetworkQuality;
  reconnectTrigger: number;
}

/**
 * Network status hook with debounced reconnect logic and visibility tracking
 * 
 * Features:
 * - 2.5s debounce on online/offline transitions
 * - Page visibility tracking (pause during backgrounding)
 * - Optional network quality detection via navigator.connection
 * - Cross-tab sync via localStorage
 * - Prevents reconnect storms on flapping connections
 */
export const useNetworkStatus = (): NetworkStatusReturn => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isVisible, setIsVisible] = useState(!document.hidden);
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>(
    navigator.onLine ? "online" : "offline"
  );
  const [quality, setQuality] = useState<NetworkQuality>("high");
  const [reconnectTrigger, setReconnectTrigger] = useState(0);
  
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTransitionRef = useRef<number>(Date.now());
  const flappingCountRef = useRef<number>(0);
  const flappingWindowRef = useRef<number>(Date.now());

  // Network quality detection (if supported)
  useEffect(() => {
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    
    if (!connection) return;

    const updateQuality = () => {
      const effectiveType = connection.effectiveType;
      const downlink = connection.downlink;

      if (!navigator.onLine) {
        setQuality("offline");
      } else if (effectiveType === "4g" && downlink > 5) {
        setQuality("high");
      } else if (effectiveType === "4g" || effectiveType === "3g") {
        setQuality("medium");
      } else {
        setQuality("low");
      }
    };

    updateQuality();
    connection.addEventListener("change", updateQuality);

    return () => {
      connection.removeEventListener("change", updateQuality);
    };
  }, []);

  // Online/Offline detection with 2.5s debounce
  useEffect(() => {
    const handleOnline = () => {
      const now = Date.now();
      
      // Detect flapping (>3 transitions within 10s window)
      if (now - flappingWindowRef.current < 10000) {
        flappingCountRef.current++;
      } else {
        flappingCountRef.current = 1;
        flappingWindowRef.current = now;
      }

      if (flappingCountRef.current > 3) {
        console.log("[Network] Flapping detected - extending debounce");
        logNetworkEvent("reconnecting", { 
          reason: "flapping",
          count: flappingCountRef.current 
        });
      }

      // Clear any pending offline debounce
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }

      // Debounce: wait 2.5s before confirming online
      const debounceMs = flappingCountRef.current > 3 ? 5000 : 2500;
      
      debounceTimeoutRef.current = setTimeout(() => {
        setIsOnline(true);
        setNetworkStatus("online");
        logNetworkEvent("online", {
          debounceMs,
          timeSinceOffline: now - lastTransitionRef.current
        });
        lastTransitionRef.current = now;
        setReconnectTrigger(prev => prev + 1); // Signal reconnect
      }, debounceMs);
    };

    const handleOffline = () => {
      const now = Date.now();
      
      // Clear any pending online debounce
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }

      // Immediate offline (no debounce for safety)
      setIsOnline(false);
      setNetworkStatus("offline");
      setQuality("offline");
      logNetworkEvent("offline", {
        timeSinceOnline: now - lastTransitionRef.current
      });
      lastTransitionRef.current = now;
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  // Visibility tracking (pause heartbeats when backgrounded)
  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = !document.hidden;
      setIsVisible(visible);
      
      if (visible && navigator.onLine) {
        logNetworkEvent("reconnecting", { reason: "visibility_restored" });
        // Trigger reconnect check when returning to foreground
        setReconnectTrigger(prev => prev + 1);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Cross-tab sync via localStorage
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "network_status" && e.newValue) {
        const status = e.newValue as NetworkStatus;
        setNetworkStatus(status);
        setIsOnline(status === "online");
      }
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  // Sync network status to localStorage for cross-tab awareness
  useEffect(() => {
    try {
      localStorage.setItem("network_status", networkStatus);
    } catch (e) {
      // Ignore localStorage errors (private browsing, etc.)
    }
  }, [networkStatus]);

  return {
    isOnline,
    isVisible,
    networkStatus,
    quality,
    reconnectTrigger,
  };
};
