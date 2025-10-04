import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { TIMING } from "@/config/constants";
import type { MessagePayload } from "@/types";

export interface Message {
  id: string;
  sender: "me" | "other";
  text: string;
  timestamp: Date;
  fading?: boolean;
}

interface UseChatMessagesReturn {
  messages: Message[];
  messageAnnouncement: string;
  messagesEndRef: React.RefObject<HTMLDivElement>;
}

export const useChatMessages = (roomId: string | null): UseChatMessagesReturn => {
  const { session } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageAnnouncement, setMessageAnnouncement] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fadeTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

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

          // Start fade timer
          const fadeTimer = setTimeout(() => {
            setMessages((prev) =>
              prev.map((m) => (m.id === message.id ? { ...m, fading: true } : m))
            );
          }, TIMING.MESSAGE_FADE_START);

          fadeTimersRef.current.set(message.id, fadeTimer);

          // Auto-delete after timeout (handled by DB, but clean up UI)
          setTimeout(() => {
            setMessages((prev) => prev.filter((m) => m.id !== message.id));
            const timer = fadeTimersRef.current.get(message.id);
            if (timer) clearTimeout(timer);
            fadeTimersRef.current.delete(message.id);
          }, TIMING.MESSAGE_AUTO_DELETE);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      fadeTimersRef.current.forEach((timer) => clearTimeout(timer));
      fadeTimersRef.current.clear();
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
  };
};
