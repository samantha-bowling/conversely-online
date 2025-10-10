import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { isRoomDataResponse } from "@/lib/validation";
import { handleError } from "@/lib/error-handler";
import { ERROR_MESSAGES, STATUS_MESSAGES, TIMING } from "@/config/constants";
import type { GetRoomDataResponse } from "@/types";

interface UseChatRoomReturn {
  roomStatus: string;
  partnerSessionId: string | null;
  partnerUsername: string;
  partnerAvatar: string;
  statusAnnouncement: string;
  setStatusAnnouncement: (announcement: string) => void;
  setIsUserInitiatedEnd: (value: boolean) => void;
  isUserInitiatedEnd: boolean;
}

export const useChatRoom = (roomId: string): UseChatRoomReturn => {
  const navigate = useNavigate();
  const { session } = useSession();
  const [roomStatus, setRoomStatus] = useState<string>("active");
  const [partnerSessionId, setPartnerSessionId] = useState<string | null>(null);
  const [partnerUsername, setPartnerUsername] = useState<string>("Anonymous");
  const [partnerAvatar, setPartnerAvatar] = useState<string>("👤");
  const [statusAnnouncement, setStatusAnnouncement] = useState("");
  const [isUserInitiatedEnd, setIsUserInitiatedEnd] = useState(false);
  
  // Refs for tracking state without causing re-renders
  const isUserInitiatedEndRef = useRef(false);
  const isMountedRef = useRef(true);

  // Track component mount state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Initialize room
  useEffect(() => {
    if (!session) {
      toast.error(ERROR_MESSAGES.NO_SESSION);
      navigate("/");
      return;
    }
    
    // Fetch room details
    const fetchRoom = async () => {
      const { data, error } = await supabase.functions.invoke<GetRoomDataResponse>('get-room-data', {
        body: {
          room_id: roomId,
        },
      });

      if (error || !data || !isRoomDataResponse(data)) {
        handleError(error, { description: ERROR_MESSAGES.ROOM_NOT_FOUND });
        navigate("/");
        return;
      }

      if (data.status === "ended") {
        // Don't auto-redirect - let Chat.tsx handle the ended state with dialog
        console.log('[useChatRoom] Initial fetch found ended room - setting state without redirect');
        setRoomStatus("ended");
        setPartnerSessionId(data.partner_id);
        setPartnerUsername(data.partner_username);
        setPartnerAvatar(data.partner_avatar);
        return;
      }

      setRoomStatus(data.status);
      setPartnerSessionId(data.partner_id);
      setPartnerUsername(data.partner_username);
      setPartnerAvatar(data.partner_avatar);
      setStatusAnnouncement(STATUS_MESSAGES.CONNECTED);
    };

    fetchRoom();
  }, [roomId, session, navigate]);

  // Subscribe to room status
  useEffect(() => {
    if (!roomId) return;

    console.log('[Realtime] Setting up room status channel:', roomId);

    // Clean up any existing stale channels
    const existingChannels = supabase.getChannels();
    const staleChannel = existingChannels.find(ch => ch.topic === `room:${roomId}`);
    if (staleChannel) {
      console.log('[Realtime] Removing stale room channel');
      supabase.removeChannel(staleChannel);
    }

    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chat_rooms",
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          const timestamp = new Date().toISOString();
          console.log(`[Realtime ${timestamp}] Room UPDATE event received:`, {
            roomId: payload.new.id,
            newStatus: payload.new.status,
            oldStatus: payload.old?.status
          });

          const newStatus = payload.new.status;
          if (newStatus === "ended") {
            // Guard: Only update state if component is still mounted
            if (!isMountedRef.current) {
              console.log(`[Realtime ${timestamp}] Component unmounted, skipping state update`);
              return;
            }

            setRoomStatus("ended");
            
            // Use ref instead of state to avoid dependency
            if (!isUserInitiatedEndRef.current) {
              setStatusAnnouncement(STATUS_MESSAGES.DISCONNECTED);
              // Toast removed - dialog will handle the notification
              console.log(`[Realtime ${timestamp}] Partner left - dialog will show`);
            } else {
              console.log(`[Realtime ${timestamp}] Room ended by current user`);
            }
          }
        }
      )
      .subscribe((status, err) => {
        const timestamp = new Date().toISOString();
        console.log(`[Realtime ${timestamp}] Room channel status:`, status);
        if (err) {
          console.error(`[Realtime ${timestamp}] Room channel error:`, err);
        }
      });

    return () => {
      const timestamp = new Date().toISOString();
      console.log(`[Realtime ${timestamp}] Cleaning up room channel`);
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [roomId]); // FIXED: Removed navigate and isUserInitiatedEnd from dependencies

  // Wrapper function to update both state and ref
  const setIsUserInitiatedEndWrapper = (value: boolean) => {
    isUserInitiatedEndRef.current = value;
    setIsUserInitiatedEnd(value);
  };

  return {
    roomStatus,
    partnerSessionId,
    partnerUsername,
    partnerAvatar,
    statusAnnouncement,
    setStatusAnnouncement,
    setIsUserInitiatedEnd: setIsUserInitiatedEndWrapper,
    isUserInitiatedEnd,
  };
};
