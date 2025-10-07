import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { isValidLocationState, isRoomDataResponse } from "@/lib/validation";
import { handleError } from "@/lib/error-handler";
import { ERROR_MESSAGES, STATUS_MESSAGES, TIMING } from "@/config/constants";
import type { GetRoomDataResponse } from "@/types";

interface UseChatRoomReturn {
  roomId: string | null;
  roomStatus: string;
  partnerSessionId: string | null;
  partnerUsername: string;
  partnerAvatar: string;
  statusAnnouncement: string;
  setStatusAnnouncement: (announcement: string) => void;
}

export const useChatRoom = (): UseChatRoomReturn => {
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useSession();
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomStatus, setRoomStatus] = useState<string>("active");
  const [partnerSessionId, setPartnerSessionId] = useState<string | null>(null);
  const [partnerUsername, setPartnerUsername] = useState<string>("Anonymous");
  const [partnerAvatar, setPartnerAvatar] = useState<string>("👤");
  const [statusAnnouncement, setStatusAnnouncement] = useState("");

  // Initialize room
  useEffect(() => {
    if (!isValidLocationState(location.state)) {
      toast.error(ERROR_MESSAGES.NO_CONVERSATION);
      navigate("/");
      return;
    }

    const room_id = location.state.room_id;

    if (!session) {
      toast.error(ERROR_MESSAGES.NO_SESSION);
      navigate("/");
      return;
    }

    setRoomId(room_id);
    
    // Fetch room details
    const fetchRoom = async () => {
      const { data, error } = await supabase.functions.invoke<GetRoomDataResponse>('get-room-data', {
        body: {
          room_id: room_id,
        },
      });

      if (error || !data || !isRoomDataResponse(data)) {
        handleError(error, { description: ERROR_MESSAGES.ROOM_NOT_FOUND });
        navigate("/");
        return;
      }

      if (data.status === "ended") {
        navigate("/");
        return;
      }

      setRoomStatus(data.status);
      setPartnerSessionId(data.partner_id);
      setPartnerUsername(data.partner_username);
      setPartnerAvatar(data.partner_avatar);
      setStatusAnnouncement(STATUS_MESSAGES.CONNECTED);
    };

    fetchRoom();
  }, [location, session, navigate]);

  // Subscribe to room status
  useEffect(() => {
    if (!roomId) return;

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
          const newStatus = payload.new.status;
          if (newStatus === "ended") {
            setRoomStatus("ended");
            setStatusAnnouncement(STATUS_MESSAGES.DISCONNECTED);
            toast.info(STATUS_MESSAGES.DISCONNECTED);
            setTimeout(() => {
              navigate("/");
            }, TIMING.ROOM_REDIRECT_DELAY);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, navigate]);

  return {
    roomId,
    roomStatus,
    partnerSessionId,
    partnerUsername,
    partnerAvatar,
    statusAnnouncement,
    setStatusAnnouncement,
  };
};
