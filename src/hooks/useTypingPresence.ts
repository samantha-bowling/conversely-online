import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface TypingUser {
  userId: string;
  name: string;
  typing: boolean;
}

export function useTypingPresence(roomId: string | null, me: { id: string; name: string }) {
  const [partnerTyping, setPartnerTyping] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastAnnounce = useRef(0);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!roomId) return;

    const channel = supabase.channel(`presence:${roomId}`, {
      config: { presence: { key: me.id } }
    });

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<TypingUser>();
      
      // Check if anyone else is typing
      const someoneTyping = Object.entries(state).some(([key, metas]) => {
        if (key === me.id) return false;
        return metas?.some((m) => m.typing === true);
      });
      
      setPartnerTyping(someoneTyping);
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ userId: me.id, name: me.name, typing: false });
      }
    });

    channelRef.current = channel;

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [roomId, me.id, me.name]);

  // Call this from input onChange - throttled to 1.5s
  const announceTyping = () => {
    const now = Date.now();
    if (now - lastAnnounce.current < 1500) return;
    
    lastAnnounce.current = now;
    channelRef.current?.track({ userId: me.id, name: me.name, typing: true });

    // Clear any existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Auto-switch back to false after 2s of no typing
    typingTimeoutRef.current = setTimeout(() => {
      channelRef.current?.track({ userId: me.id, name: me.name, typing: false });
    }, 2000);
  };

  return { partnerTyping, announceTyping };
}
