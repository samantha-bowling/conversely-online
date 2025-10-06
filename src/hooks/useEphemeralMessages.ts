import { useEffect } from "react";
import { TIMING } from "@/config/constants";

export interface EphemeralMessage {
  id: string;
  timestamp: Date;
  fading?: boolean;
  remaining?: number;
}

interface UseEphemeralMessagesProps<T extends EphemeralMessage> {
  messages: T[];
  setMessages: React.Dispatch<React.SetStateAction<T[]>>;
}

/**
 * Consolidated timer hook that manages message lifecycle with a single interval.
 * Calculates remaining time and updates fading state for all messages efficiently.
 */
export const useEphemeralMessages = <T extends EphemeralMessage>({
  messages,
  setMessages,
}: UseEphemeralMessagesProps<T>) => {
  useEffect(() => {
    if (messages.length === 0) return;

    const intervalId = setInterval(() => {
      const now = Date.now();
      
      setMessages((prevMessages) => {
        const updated: T[] = [];
        
        for (const msg of prevMessages) {
          const elapsed = now - msg.timestamp.getTime();
          const remaining = TIMING.MESSAGE_AUTO_DELETE - elapsed;
          
          // Skip expired messages
          if (remaining <= 0) continue;
          
          // Update fading state and remaining time
          const shouldFade = remaining <= (TIMING.MESSAGE_AUTO_DELETE - TIMING.MESSAGE_FADE_START);
          
          updated.push({
            ...msg,
            remaining,
            fading: shouldFade,
          } as T);
        }
        
        return updated;
      });
    }, 500); // Update every 500ms for smooth countdown

    return () => clearInterval(intervalId);
  }, [messages.length, setMessages]);
};
