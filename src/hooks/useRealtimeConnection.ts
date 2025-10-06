import { useEffect, useState, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type ConnectionStatus = "connected" | "reconnecting" | "offline";

export function useRealtimeConnection(channel: RealtimeChannel | null) {
  const [status, setStatus] = useState<ConnectionStatus>("connected");
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);

  useEffect(() => {
    if (!channel) return;

    const handleSystemEvent = (event: any) => {
      if (event.type === "system") {
        switch (event.event) {
          case "disconnect":
            setStatus("reconnecting");
            scheduleRetry();
            break;
          case "error":
            setStatus("offline");
            scheduleRetry();
            break;
          default:
            if (channel.state === "joined") {
              setStatus("connected");
              retryCountRef.current = 0;
              if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
              }
            }
        }
      }
    };

    const scheduleRetry = () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }

      // Exponential backoff with jitter: min(30s, 2^n * 500ms + random(0-300ms))
      const baseDelay = Math.min(30000, Math.pow(2, retryCountRef.current) * 500);
      const jitter = Math.random() * 300;
      const delay = baseDelay + jitter;

      retryCountRef.current++;

      retryTimeoutRef.current = setTimeout(() => {
        if (channel.state !== "joined") {
          channel.subscribe();
        }
      }, delay);
    };

    // Monitor channel state changes
    const stateCheckInterval = setInterval(() => {
      if (channel.state === "joined" && status !== "connected") {
        setStatus("connected");
        retryCountRef.current = 0;
      } else if (channel.state === "closed" && status !== "offline") {
        setStatus("offline");
        scheduleRetry();
      }
    }, 1000);

    return () => {
      clearInterval(stateCheckInterval);
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [channel, status]);

  return status;
}
