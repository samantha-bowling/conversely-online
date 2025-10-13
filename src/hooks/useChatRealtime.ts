import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { isRoomDataResponse } from "@/lib/validation";
import { handleError } from "@/lib/error-handler";
import { ERROR_MESSAGES, STATUS_MESSAGES, TIMING } from "@/config/constants";
import type { GetRoomDataResponse, MessagePayload } from "@/types";
import { useEphemeralMessages } from "./useEphemeralMessages";

export type ConnectionStatus = "connected" | "reconnecting" | "offline" | "partner_disconnected";

export interface Message {
  id: string;
  sender: "me" | "other";
  text: string;
  timestamp: Date;
  fading?: boolean;
  remaining?: number;
  pending?: boolean;
}

interface UseChatRealtimeReturn {
  // Room state
  roomStatus: string;
  partnerSessionId: string | null;
  partnerUsername: string;
  partnerAvatar: string;
  statusAnnouncement: string;
  setStatusAnnouncement: (announcement: string) => void;
  setIsUserInitiatedEnd: (value: boolean) => void;
  isUserInitiatedEnd: boolean;
  
  // Messages state
  messages: Message[];
  messageAnnouncement: string;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  loading: boolean;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  
  // Connection state
  connectionStatus: ConnectionStatus;
}

/**
 * Consolidated realtime hook that manages both room status and messages
 * using a single Supabase channel to prevent channel conflicts.
 */
export const useChatRealtime = (roomId: string): UseChatRealtimeReturn => {
  const navigate = useNavigate();
  const { session } = useSession();
  
  // Room state
  const [roomStatus, setRoomStatus] = useState<string>("active");
  const [partnerSessionId, setPartnerSessionId] = useState<string | null>(null);
  const [partnerUsername, setPartnerUsername] = useState<string>("Anonymous");
  const [partnerAvatar, setPartnerAvatar] = useState<string>("👤");
  const [statusAnnouncement, setStatusAnnouncement] = useState("");
  const [isUserInitiatedEnd, setIsUserInitiatedEnd] = useState(false);
  
  // Messages state
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageAnnouncement, setMessageAnnouncement] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  
  // Connection state
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connected');
  
  // Refs for lifecycle management
  const isUserInitiatedEndRef = useRef(false);
  const isMountedRef = useRef(true);
  const isSubscribedRef = useRef(false);
  const retryDelayRef = useRef(1000);
  const maxRetryDelay = 10000;
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Use consolidated timer hook for message expiration
  useEphemeralMessages({ messages, setMessages });

  // Track component mount state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Initial data fetching
  useEffect(() => {
    if (!session?.id || !roomId) {
      setLoading(false);
      return;
    }

    const fetchInitialData = async () => {
      const timestamp = new Date().toISOString();
      console.log(`[Realtime ${timestamp}] Fetching initial data for room:`, roomId);

      // Fetch room data
      try {
        const { data: roomData, error: roomError } = await supabase.functions.invoke<GetRoomDataResponse>('get-room-data', {
          body: { room_id: roomId },
        });

        if (roomError || !roomData || !isRoomDataResponse(roomData)) {
          handleError(roomError, { description: ERROR_MESSAGES.ROOM_NOT_FOUND });
          navigate("/");
          return;
        }

        if (roomData.status === "ended") {
          console.log(`[Realtime ${timestamp}] Initial fetch found ended room - setting state without redirect`);
          setRoomStatus("ended");
          setPartnerSessionId(roomData.partner_id);
          setPartnerUsername(roomData.partner_username);
          setPartnerAvatar(roomData.partner_avatar);
        } else {
          setRoomStatus(roomData.status);
          setPartnerSessionId(roomData.partner_id);
          setPartnerUsername(roomData.partner_username);
          setPartnerAvatar(roomData.partner_avatar);
          setStatusAnnouncement(STATUS_MESSAGES.CONNECTED);
        }
      } catch (error) {
        console.error(`[Realtime ${timestamp}] Failed to fetch room data:`, error);
        handleError(error, { description: ERROR_MESSAGES.ROOM_NOT_FOUND });
        navigate("/");
        return;
      }

      // Fetch messages
      try {
        console.log(`[Realtime ${timestamp}] Fetching initial messages for room:`, roomId);
        const { data: messagesData, error: messagesError } = await supabase
          .from('messages')
          .select('*')
          .eq('room_id', roomId)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: true })
          .limit(50);

        if (messagesError) {
          console.error(`[Realtime ${timestamp}] Failed to fetch initial messages:`, messagesError);
        } else if (messagesData) {
          const fetchedMessages: Message[] = messagesData.map(msg => ({
            id: msg.id,
            sender: msg.session_id === session.id ? "me" : "other",
            text: msg.content,
            timestamp: new Date(msg.created_at),
            fading: false,
          }));
          console.log(`[Realtime ${timestamp}] Loaded ${fetchedMessages.length} messages`);
          setMessages(fetchedMessages);
        }
      } catch (error) {
        console.error(`[Realtime ${timestamp}] Error fetching messages:`, error);
      }

      setLoading(false);
    };

    fetchInitialData();
  }, [roomId, session?.id, navigate]); // ✅ Only depend on session.id primitive

  // Consolidated realtime subscription
  useEffect(() => {
    console.log('[Realtime] Session ID for realtime effect:', session?.id);
    if (!roomId || !session?.id || isSubscribedRef.current) {
      return;
    }

    const timestamp = new Date().toISOString();
    console.log(`[Realtime ${timestamp}] Setting up consolidated channel for room:`, roomId);

    // Guard: prevent double subscription
    isSubscribedRef.current = true;

    // Clean up any existing stale channels
    const existingChannels = supabase.getChannels();
    const staleMessageChannel = existingChannels.find(ch => ch.topic === `messages:${roomId}`);
    const staleRoomChannel = existingChannels.find(ch => ch.topic === `room:${roomId}`);
    const staleConsolidatedChannel = existingChannels.find(ch => ch.topic === `chat:${roomId}`);
    
    if (staleMessageChannel) {
      console.log(`[Realtime ${timestamp}] Removing stale messages channel`);
      supabase.removeChannel(staleMessageChannel);
    }
    if (staleRoomChannel) {
      console.log(`[Realtime ${timestamp}] Removing stale room channel`);
      supabase.removeChannel(staleRoomChannel);
    }
    if (staleConsolidatedChannel) {
      console.log(`[Realtime ${timestamp}] Removing stale consolidated channel`);
      supabase.removeChannel(staleConsolidatedChannel);
    }

    // Debounced message insert handler (100ms debounce)
    let messageInsertTimeout: NodeJS.Timeout | null = null;
    const debouncedMessageInsert = (newMsg: MessagePayload) => {
      if (messageInsertTimeout) clearTimeout(messageInsertTimeout);
      messageInsertTimeout = setTimeout(() => {
        const insertTimestamp = new Date().toISOString();
        console.log(`[Realtime ${insertTimestamp}] Processing debounced message INSERT:`, {
          messageId: newMsg.id,
          sessionId: newMsg.session_id,
          content: newMsg.content?.substring(0, 20) + '...',
          isMyMessage: newMsg.session_id === session.id,
        });

        if (!isMountedRef.current) {
          console.log(`[Realtime ${insertTimestamp}] Component unmounted, skipping message insert`);
          return;
        }

        const sender = newMsg.session_id === session.id ? "me" : "other";
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
      }, 100);
    };

    // Create consolidated channel with two listeners
    const channel = supabase
      .channel(`chat:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const eventTimestamp = new Date().toISOString();
          console.log(`[Realtime ${eventTimestamp}] Message INSERT event received:`, {
            messageId: payload.new.id,
            sessionId: payload.new.session_id,
            content: payload.new.content?.substring(0, 20) + '...',
          });
          debouncedMessageInsert(payload.new as MessagePayload);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chat_rooms",
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          const eventTimestamp = new Date().toISOString();
          console.log(`[Realtime ${eventTimestamp}] Room UPDATE event received:`, {
            roomId: payload.new.id,
            newStatus: payload.new.status,
            oldStatus: payload.old?.status
          });

          const newStatus = payload.new.status;
          if (newStatus === "ended") {
            // Guard: Only update state if component is still mounted
            if (!isMountedRef.current) {
              console.log(`[Realtime ${eventTimestamp}] Component unmounted, skipping state update`);
              return;
            }

            setRoomStatus("ended");

            // Use ref instead of state to avoid dependency
            if (!isUserInitiatedEndRef.current) {
              setStatusAnnouncement(STATUS_MESSAGES.DISCONNECTED);
              console.log(`[Realtime ${eventTimestamp}] Partner left - dialog will show`);
            } else {
              console.log(`[Realtime ${eventTimestamp}] Room ended by current user`);
            }
          }
        }
      )
      .subscribe((status, err) => {
        const subTimestamp = new Date().toISOString();
        console.log(`[Realtime ${subTimestamp}] Consolidated channel status:`, status);
        console.log(`[Realtime ${subTimestamp}] Channel topic:`, channel.topic);
        console.log(`[Realtime ${subTimestamp}] Channel state:`, channel.state);

        if (status === 'SUBSCRIBED') {
          console.log(`[Realtime ${subTimestamp}] ✅ Successfully subscribed to consolidated channel`);
          setConnectionStatus('connected');
          retryDelayRef.current = 1000; // Reset retry delay on success
          if (retryTimeoutRef.current) {
            clearTimeout(retryTimeoutRef.current);
            retryTimeoutRef.current = null;
          }
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`[Realtime ${subTimestamp}] ⚠️ Channel error - retrying in ${retryDelayRef.current}ms`, err);
          setConnectionStatus('offline');
          
          // Exponential backoff retry
          if (retryTimeoutRef.current) {
            clearTimeout(retryTimeoutRef.current);
          }

          retryTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current && roomId) {
              const retryTimestamp = new Date().toISOString();
              console.log(`[Realtime ${retryTimestamp}] Attempting to retry subscription`);
              isSubscribedRef.current = false; // Allow resubscription
            }
          }, retryDelayRef.current);

          retryDelayRef.current = Math.min(retryDelayRef.current * 2, maxRetryDelay);
        } else if (status === 'CLOSED') {
          console.log(`[Realtime ${subTimestamp}] Channel closed`);
          setConnectionStatus('reconnecting');
        }

        if (err) {
          console.error(`[Realtime ${subTimestamp}] Channel error details:`, err);
        }
      });

    // WebSocket recovery handler
    const handleRealtimeOpen = () => {
      const openTimestamp = new Date().toISOString();
      console.log(`[Realtime ${openTimestamp}] WebSocket connection opened/recovered`);
      retryDelayRef.current = 1000; // Reset retry delay
      setConnectionStatus('connected');
    };

    // Note: supabase.realtime doesn't expose onOpen directly, but we can monitor state
    const stateCheckInterval = setInterval(() => {
      if (channel.state === 'joined' && connectionStatus !== 'connected') {
        handleRealtimeOpen();
      }
    }, 1000);

    return () => {
      const cleanupTimestamp = new Date().toISOString();
      console.log(`[Realtime ${cleanupTimestamp}] 🧹 Cleaning up consolidated channel (intentional teardown)`);
      
      clearInterval(stateCheckInterval);
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      if (messageInsertTimeout) {
        clearTimeout(messageInsertTimeout);
      }

      // Safe cleanup: check state before unsubscribe
      if (channel.state !== 'closed') {
        channel.unsubscribe();
        supabase.removeChannel(channel);
      }

      isSubscribedRef.current = false;
    };
  }, [roomId, session?.id]); // ✅ Only depend on session.id primitive to prevent unnecessary teardowns

  // ============================================================================
  // ✅ Polling fallback with heartbeat-based disconnect detection
  // Checks every 5s for room status changes AND partner heartbeat liveness
  // ============================================================================
  useEffect(() => {
    if (!roomId || !session?.id) return;

    const isPollingRef = useRef(false);
    let pollCount = 0;
    let lastSuccessfulPoll = Date.now();

    const pollInterval = setInterval(async () => {
      // ✅ Prevent stacking RPC calls (network latency >5s)
      if (isPollingRef.current) {
        console.log('[Polling] Skipping - previous poll still active');
        return;
      }

      isPollingRef.current = true;
      pollCount++;

      try {
        // Check room status
        const { data: roomData, error: roomError } = await supabase
          .from('chat_rooms')
          .select('status')
          .eq('id', roomId)
          .single();

        if (roomError) {
          console.error('[Polling] Room fetch error:', roomError);
          if (pollCount > 3 && Date.now() - lastSuccessfulPoll > 20000) {
            console.log('[Polling] Multiple failures - marking offline');
            setConnectionStatus('offline');
          }
          return;
        }

        // ✅ Check partner heartbeat
        const { data: heartbeatData, error: heartbeatError } = await supabase
          .rpc('check_partner_heartbeat' as any, {
            _room_id: roomId,
            _my_session_id: session.id
          }) as any;

        if (heartbeatError) {
          console.error('[Polling] Heartbeat check error:', heartbeatError);
        }

        // ✅ Warn if empty RPC result (shouldn't happen, but defensive)
        if (!heartbeatData || !Array.isArray(heartbeatData) || heartbeatData.length === 0) {
          console.warn('[Polling] No heartbeat data returned - defaulting to alive');
        }

        const partnerAlive = heartbeatData?.[0]?.partner_alive ?? true;
        const lastHeartbeat = heartbeatData?.[0]?.last_heartbeat;
        
        console.log('[Polling]', {
          roomStatus: roomData?.status,
          partnerAlive,
          lastHeartbeat,
          age: lastHeartbeat ? Math.floor((Date.now() - new Date(lastHeartbeat).getTime()) / 1000) : 'N/A'
        });

        // ✅ Reset connection status on successful poll
        if (connectionStatus !== 'connected') {
          setConnectionStatus('connected');
        }
        lastSuccessfulPoll = Date.now();
        pollCount = 0;

        // Update UI if room ended OR partner heartbeat stale
        if (
          (roomData?.status === 'ended' || (!partnerAlive && roomData?.status === 'active')) &&
          roomStatus !== 'ended'
        ) {
          const disconnectReason = partnerAlive ? 'room_ended' : 'heartbeat_stale';
          console.log(`[Polling] DISCONNECT DETECTED via ${disconnectReason}`);
          
          setRoomStatus('ended');
          setStatusAnnouncement(partnerAlive ? STATUS_MESSAGES.DISCONNECTED : STATUS_MESSAGES.DISCONNECTED);
        }
      } catch (err) {
        console.error('[Polling] Unexpected error:', err);
      } finally {
        isPollingRef.current = false;
      }
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [roomId, session?.id, roomStatus, connectionStatus]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
    messages,
    messageAnnouncement,
    messagesEndRef,
    loading,
    setMessages,
    connectionStatus,
  };
};
