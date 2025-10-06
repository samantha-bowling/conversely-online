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
      .subscribe();

    setMessagesChannel(channel);

    return () => {
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
