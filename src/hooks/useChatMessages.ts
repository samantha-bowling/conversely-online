import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import type { MessagePayload } from "@/types";
import { useEphemeralMessages } from "./useEphemeralMessages";

export interface Message {
  id: string;
  sender: "me" | "other";
  text: string;
  timestamp: Date;
  fading?: boolean;
  remaining?: number;
}

interface UseChatMessagesReturn {
  messages: Message[];
  messageAnnouncement: string;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  messagesChannel: ReturnType<typeof supabase.channel> | null;
}

export const useChatMessages = (roomId: string | null): UseChatMessagesReturn => {
  const { session } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageAnnouncement, setMessageAnnouncement] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messagesChannel, setMessagesChannel] = useState<ReturnType<typeof supabase.channel> | null>(null);

  // Use consolidated timer hook
  useEphemeralMessages({ messages, setMessages });

  // Subscribe to messages
  useEffect(() => {
    if (!roomId) return;

    console.log('[Realtime] Setting up messages channel:', roomId);

    // Clean up any existing stale channels
    const existingChannels = supabase.getChannels();
    const staleChannel = existingChannels.find(ch => ch.topic === `messages:${roomId}`);
    if (staleChannel) {
      console.log('[Realtime] Removing stale messages channel');
      supabase.removeChannel(staleChannel);
    }

    const channel = supabase
      .channel(`messages:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          console.log('[Realtime] Message INSERT event received:', {
            messageId: payload.new.id,
            sessionId: payload.new.session_id,
            content: payload.new.content?.substring(0, 20) + '...',
            isMyMessage: payload.new.session_id === session?.id
          });

          const newMsg = payload.new as MessagePayload;
          const sender = newMsg.session_id === session?.id ? "me" : "other";
          
          const message: Message = {
            id: newMsg.id,
            sender,
            text: newMsg.content,
            timestamp: new Date(newMsg.created_at),
            fading: false,
          };

          setMessages((prev) => [...prev, message]);
          
          // Announce new message to screen readers
          if (sender === "other") {
            setMessageAnnouncement(`New message received: ${newMsg.content}`);
          }
        }
      )
      .subscribe((status, err) => {
        console.log('[Realtime] Messages channel status:', status);
        if (err) {
          console.error('[Realtime] Messages channel error:', err);
        }
      });

    setMessagesChannel(channel);

    return () => {
      console.log('[Realtime] Cleaning up messages channel');
      supabase.removeChannel(channel);
      setMessagesChannel(null);
    };
  }, [roomId, session]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return {
    messages,
    messageAnnouncement,
    messagesEndRef,
    messagesChannel,
  };
};
