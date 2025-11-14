import { useState, useEffect, useRef } from "react";
import { useNavigate, Link, useParams, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { toast } from "sonner";
import { validateMessage } from "@/lib/validation";
import { isUuid } from "@/lib/validation-utils";
import { handleApiError } from "@/lib/error-handler";
import { getRandomPrompt } from "@/config/prompts";
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from "@/config/constants";
import { HEARTBEAT_INTERVAL_MS } from "@/config/heartbeat";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChatGuidelines } from "@/components/chat/ChatGuidelines";
import { ChatPromptDialog } from "@/components/chat/ChatPromptDialog";
import { ReflectionDialog } from "@/components/chat/ReflectionDialog";
import { ConnectionStatusBanner } from "@/components/chat/ConnectionStatusBanner";
import { PostChatDialog } from "@/components/chat/PostChatDialog";
import { SessionExpiryWarning } from "@/components/SessionExpiryWarning";
import { useChatRealtime } from "@/hooks/useChatRealtime";
import { useTypingPresence } from "@/hooks/useTypingPresence";
import { useSessionExpiry } from "@/hooks/useSessionExpiry";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useMessageQueue } from "@/hooks/useMessageQueue";
import { logNetworkEvent } from "@/lib/network-telemetry";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Info } from "lucide-react";
import type { SendMessageResponse, EndChatResponse, BlockUserResponse } from '@/types';
import { Footer } from "@/components/Footer";
import { QuickReportSheet } from "@/components/QuickReportSheet";
import { PrivacyRequestsSheet } from "@/components/PrivacyRequestsSheet";

const Chat = () => {
  const navigate = useNavigate();
  const { roomId: roomIdParam } = useParams<{ roomId: string }>();
  const { session } = useSession();

  // Early validation of roomId URL parameter
  if (!roomIdParam || !isUuid(roomIdParam)) {
    return <Navigate to="/" replace />;
  }

  const roomId = roomIdParam;

  const [inputText, setInputText] = useState("");
  const [showGuidelines, setShowGuidelines] = useState(true);
  const [showPromptDialog, setShowPromptDialog] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState(getRandomPrompt);
  const [shufflesRemaining, setShufflesRemaining] = useState(3);
  const [showExpiryBanner, setShowExpiryBanner] = useState(true);
  const [isEndingChat, setIsEndingChat] = useState(false);
  const [showReportSheet, setShowReportSheet] = useState(false);
  const [showReflectionDialog, setShowReflectionDialog] = useState(false);
  const [showNewMatchDialog, setShowNewMatchDialog] = useState(false);
  const [showReflectionFromPartnerLeft, setShowReflectionFromPartnerLeft] = useState(false);
  const [showPostChatDialog, setShowPostChatDialog] = useState(false);
  const [showPrivacySheet, setShowPrivacySheet] = useState(false);
  const [showEndChatConfirmation, setShowEndChatConfirmation] = useState(false);
  
  // Track component mount state for toast timing guard
  const isMounted = useRef(true);

  // Safety net handlers for ReflectionDialog - ensures navigation even if dialog closes unexpectedly
  const handleReflectionDialogChange = (open: boolean) => {
    if (!open) {
      console.log('[Chat] ReflectionDialog closed unexpectedly - redirecting to PostChatDialog');
      setShowReflectionDialog(false);
      setShowPostChatDialog(true);
    }
  };

  const handlePartnerLeftReflectionChange = (open: boolean) => {
    if (!open) {
      console.log('[Chat] PartnerLeft ReflectionDialog closed unexpectedly - redirecting to PostChatDialog');
      setShowReflectionFromPartnerLeft(false);
      setShowPostChatDialog(true);
    }
  };

  // Message queue for reliable delivery
  const { enqueueMessage, queuedCount, isProcessing: isQueueProcessing } = useMessageQueue(
    session?.id || '',
    async (roomId, content, clientId) => {
      // Pre-send validation: Check if room is still active
      if (roomStatus !== 'active') {
        throw new Error('ROOM_ENDED');
      }
      
      const { data, error } = await supabase.functions.invoke('send-message', {
        body: {
          room_id: roomId,
          content,
          client_id: clientId,
        },
      });
      if (error) throw error;
      return data;
    }
  );
  
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const { 
    roomStatus, 
    partnerUsername, 
    partnerAvatar, 
    statusAnnouncement, 
    setStatusAnnouncement,
    setIsUserInitiatedEnd,
    isUserInitiatedEnd,
    messages,
    messageAnnouncement,
    messagesEndRef,
    loading,
    setMessages,
    connectionStatus,
  } = useChatRealtime(roomId);
  
  // Monitor session expiry
  useSessionExpiry(session?.expires_at || null);
  const { partnerTyping, announceTyping } = useTypingPresence(
    roomId, 
    { id: session?.id || "", name: session?.username || "Anonymous" }
  );

  // Network status tracking
  const { networkStatus: networkOnlineStatus, isVisible } = useNetworkStatus();
  
  // Debug log for visibility changes
  useEffect(() => {
    console.log(`[Heartbeat] Visibility changed: ${isVisible ? 'visible' : 'hidden'}`);
  }, [isVisible]);

  // ============================================================================
  // ✅ Heartbeat System for Partner Disconnect Detection
  // Sends heartbeat every 15s to allow partner to detect disconnect within ~30s
  // ============================================================================
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSentRef = useRef<number>(0);

  useEffect(() => {
    if (!session?.id || roomStatus !== 'active') return;

    const sendHeartbeat = async () => {
      // ✅ Prevent flood on rapid status toggles
      if (Date.now() - lastSentRef.current < 5000) {
        console.log('[Chat] Skipping heartbeat - too soon since last send');
        return;
      }

      // ✅ Skip if offline to prevent error spam
      if (networkOnlineStatus === 'offline') {
        console.log('[Chat] Skipping heartbeat - offline');
        return;
      }

      try {
        const { error } = await supabase
          .from('guest_sessions')
          .update({ last_heartbeat_at: new Date().toISOString() })
          .eq('id', session.id);

        if (error) {
          console.error('[Chat] Heartbeat error:', error);
          logNetworkEvent('offline', { 
            component: 'chat',
            reason: 'heartbeat_error' 
          });
        } else {
          lastSentRef.current = Date.now();
          console.log('[Chat] Heartbeat sent');
        }
      } catch (err) {
        console.error('[Chat] Heartbeat failed:', err);
        logNetworkEvent('offline', { 
          component: 'chat',
          reason: 'heartbeat_failed' 
        });
      }
    };

    // Send initial heartbeat
    sendHeartbeat();

    // Send heartbeat using centralized constant
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      // Send final heartbeat on unmount
      sendHeartbeat();
    };
  }, [session?.id, roomStatus, networkOnlineStatus, isVisible]);

  // Dynamic viewport height for mobile browsers
  useEffect(() => {
    const updateVH = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    updateVH();
    window.addEventListener('resize', updateVH);
    return () => window.removeEventListener('resize', updateVH);
  }, []);


  // Send final heartbeat attempt on tab close (Defense in Depth)
  useEffect(() => {
    if (!session?.id) return;

    const handleBeforeUnload = () => {
      // Use navigator.sendBeacon for reliable unload signaling
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const url = `${supabaseUrl}/rest/v1/guest_sessions?id=eq.${session.id}`;
      
      const payload = JSON.stringify({ 
        last_heartbeat_at: new Date().toISOString()
      });

      const blob = new Blob([payload], { type: 'application/json' });
      const sent = navigator.sendBeacon(url, blob);
      
      // Fallback to fetch with keepalive if beacon fails (rare)
      if (!sent) {
        fetch(url, { 
          method: 'PATCH', 
          body: payload,
          keepalive: true,
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
          }
        }).catch(() => {/* Ignore errors during unload */});
      }
      
      console.log('[Chat] Final heartbeat beacon sent:', sent);
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [session?.id]);

  // Auto-hide expiry banner after first message
  useEffect(() => {
    if (messages.length > 0) {
      const timer = setTimeout(() => setShowExpiryBanner(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [messages.length]);

  // Wait for session to stabilize before rendering chat UI
  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Loading chat...</p>
        </div>
      </div>
    );
  }

  const handleSend = async () => {
    if (!inputText.trim() || !roomId || !session) return;

    const messageText = inputText.trim();
    
    // Client-side validation
    const validation = validateMessage(messageText);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    // Clear input immediately for better UX
    setInputText("");
    
    // Enqueue message - queue handles sending, retries, and errors
    await enqueueMessage(roomId, messageText);
  };

  const handleEndChatClick = () => {
    setShowEndChatConfirmation(true);
  };

  const handleEndChatConfirm = async () => {
    if (!roomId || !session || isEndingChat) return;

    setShowEndChatConfirmation(false);
    setIsUserInitiatedEnd(true);
    setIsEndingChat(true);

    try {
      const { data, error } = await supabase.functions.invoke<EndChatResponse>('end-chat', {
        body: {
          room_id: roomId,
        },
      });

      if (error) {
        handleApiError(error, ERROR_MESSAGES.END_CHAT_FAILED);
        return;
      }

      if (data?.success) {
        // Show reflection dialog immediately after success
        setShowReflectionDialog(true);
      }
    } catch (error) {
      handleApiError(error, ERROR_MESSAGES.END_CHAT_FAILED);
    } finally {
      setIsEndingChat(false);
    }
  };

  const handleShuffle = () => {
    if (shufflesRemaining <= 0) return;
    setCurrentPrompt(getRandomPrompt());
    setShufflesRemaining(prev => prev - 1);
  };

  const handleInsertPrompt = () => {
    setInputText(currentPrompt);
  };

  const handleShowPrompt = () => {
    setShowPromptDialog(true);
  };

  // Reset shuffle counter only when entering a new room
  useEffect(() => {
    if (roomId) {
      setShufflesRemaining(3);
      setCurrentPrompt(getRandomPrompt());
    }
  }, [roomId]);

  const handleReflectionSubmit = async (rating: number | null, feedback: string) => {
    if (!roomId || !session) {
      navigate("/");
      return;
    }

    // Sanity check: Ensure Supabase functions are initialized
    if (!supabase.functions) {
      console.error('[Reflection] Supabase functions not initialized');
      if (isMounted.current) {
        toast.error('Unable to submit feedback. Please try again.');
      }
      setShowReflectionDialog(false);
      setShowPostChatDialog(true);
      return;
    }

    try {
      const { error } = await supabase.functions.invoke('submit-reflection', {
        body: {
          room_id: roomId,
          rating,
          feedback: feedback.trim() || null,
        },
      });

      if (error) {
        if (import.meta.env.MODE === 'development') {
          console.error('[Telemetry] reflection_submit_failed', {
            room_id: roomId,
            error: error.message,
            has_rating: rating !== null,
            has_feedback: !!feedback.trim()
          });
        }
        if (isMounted.current) {
          toast.error('Failed to save feedback');
        }
      } else {
        if (import.meta.env.MODE === 'development') {
          console.log('[Telemetry] reflection_submitted', {
            room_id: roomId,
            rating,
            has_feedback: !!feedback.trim()
          });
        }
        if (isMounted.current) {
          toast.success('Thank you for your feedback!');
        }
      }
    } catch (error) {
      if (import.meta.env.MODE === 'development') {
        console.error('[Telemetry] reflection_unexpected_error', {
          room_id: roomId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    } finally {
      setShowReflectionDialog(false);
      setShowPostChatDialog(true);
    }
  };

  const handleReflectionSkip = () => {
    setShowReflectionDialog(false);
    setShowPostChatDialog(true); // Show modal instead of direct navigation
  };

  // Handler for reflection from partner-left dialog
  const handlePartnerLeftReflection = () => {
    console.log('[Chat] Opening reflection from partner-left dialog');
    setShowPostChatDialog(false);
    setShowReflectionFromPartnerLeft(true);
  };

  const handlePartnerLeftReflectionSubmit = async (rating: number | null, feedback: string) => {
    if (!roomId || !session) {
      navigate("/");
      return;
    }

    // Sanity check: Ensure Supabase functions are initialized
    if (!supabase.functions) {
      console.error('[Reflection] Supabase functions not initialized');
      if (isMounted.current) {
        toast.error('Unable to submit feedback. Please try again.');
      }
      setShowReflectionFromPartnerLeft(false);
      setShowPostChatDialog(true);
      return;
    }

    try {
      const { error } = await supabase.functions.invoke('submit-reflection', {
        body: {
          room_id: roomId,
          rating,
          feedback: feedback.trim() || null,
        },
      });

      if (error) {
        if (import.meta.env.MODE === 'development') {
          console.error('[Telemetry] reflection_submit_failed', {
            room_id: roomId,
            error: error.message,
            has_rating: rating !== null,
            has_feedback: !!feedback.trim()
          });
        }
        if (isMounted.current) {
          toast.error('Failed to save feedback');
        }
      } else {
        if (import.meta.env.MODE === 'development') {
          console.log('[Telemetry] reflection_submitted', {
            room_id: roomId,
            rating,
            has_feedback: !!feedback.trim()
          });
        }
        if (isMounted.current) {
          toast.success('Thank you for your feedback!');
        }
      }
    } catch (error) {
      if (import.meta.env.MODE === 'development') {
        console.error('[Telemetry] reflection_unexpected_error', {
          room_id: roomId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    } finally {
      setShowReflectionFromPartnerLeft(false);
      setShowPostChatDialog(true);
    }
  };

  const handlePartnerLeftReflectionSkip = () => {
    console.log('[Chat] Skipping reflection from partner-left dialog');
    setShowReflectionFromPartnerLeft(false);
    // Return to partner-left dialog
    setShowPostChatDialog(true);
  };

  const handlePostChatNewConversation = () => {
    setShowPostChatDialog(false);
    navigate("/matching");
  };

  const handlePostChatReturnHome = () => {
    setShowPostChatDialog(false);
    navigate("/");
  };

  const handlePostChatClose = () => {
    // Soft close - allow ESC or backdrop click
    setShowPostChatDialog(false);
    navigate("/"); // Default to home
  };

  const handleReport = () => {
    setShowReportSheet(true);
  };

  const handleNewMatch = async () => {
    if (!roomId || !session) return;
    
    setShowNewMatchDialog(false);
    setIsUserInitiatedEnd(true);
    setIsEndingChat(true);

    try {
      const { data, error } = await supabase.functions.invoke<EndChatResponse>('end-chat', {
        body: { room_id: roomId },
      });

      if (error) {
        handleApiError(error, ERROR_MESSAGES.END_CHAT_FAILED);
        return;
      }

      if (data?.success) {
        // Skip reflection dialog and go directly to matching
        toast.info("Finding you a new match...");
        navigate("/matching");
      }
    } catch (error) {
      handleApiError(error, ERROR_MESSAGES.END_CHAT_FAILED);
    } finally {
      setIsEndingChat(false);
    }
  };

  // Show post-chat dialog when room ends (handles both user-ended and partner-left)
  useEffect(() => {
    if (roomStatus === "ended" && !isUserInitiatedEnd) {
      console.log('[Chat] Partner left - showing PostChatDialog with partner-left variant');
      setShowPostChatDialog(true);
    }
  }, [roomStatus, isUserInitiatedEnd]);

  // Debug logging for testing rapid navigation
  useEffect(() => {
    console.log('[Chat Debug] State:', {
      roomStatus,
      isUserInitiatedEnd,
      showPostChatDialog,
      showReflectionDialog,
      showReflectionFromPartnerLeft
    });
  }, [roomStatus, isUserInitiatedEnd, showPostChatDialog, showReflectionDialog, showReflectionFromPartnerLeft]);

  return (
    <div 
      className="flex flex-col bg-background"
      style={{ minHeight: 'calc(var(--vh, 1vh) * 100)' }}
    >
      {/* Skip to main content link */}
      <a 
        href="#message-input" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md"
      >
        Skip to message input
      </a>
      
      {/* Screen reader announcements */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {statusAnnouncement}
      </div>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {messageAnnouncement}
      </div>
      
      {/* Guidelines Dialog */}
      <ChatGuidelines open={showGuidelines} onOpenChange={setShowGuidelines} />

      {/* Prompt Dialog */}
      <ChatPromptDialog 
        open={showPromptDialog} 
        onOpenChange={setShowPromptDialog} 
        prompt={currentPrompt}
        shufflesRemaining={shufflesRemaining}
        onShuffle={handleShuffle}
        onInsert={handleInsertPrompt}
      />

      {/* Reflection Dialog - User-initiated end */}
      <ReflectionDialog
        open={showReflectionDialog}
        onOpenChange={handleReflectionDialogChange}
        onSubmit={handleReflectionSubmit}
        onSkip={handleReflectionSkip}
      />

      {/* Reflection Dialog - Partner left (optional) */}
      <ReflectionDialog
        open={showReflectionFromPartnerLeft}
        onOpenChange={handlePartnerLeftReflectionChange}
        onSubmit={handlePartnerLeftReflectionSubmit}
        onSkip={handlePartnerLeftReflectionSkip}
      />

      {/* New Match Confirmation Dialog */}
      <Dialog open={showNewMatchDialog} onOpenChange={setShowNewMatchDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Find a New Match?</DialogTitle>
            <DialogDescription>
              This will end your current conversation and connect you with someone new.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewMatchDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleNewMatch} disabled={isEndingChat}>
              {isEndingChat ? "Ending..." : "Find New Match"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* End Chat Confirmation Dialog */}
      <Dialog open={showEndChatConfirmation} onOpenChange={setShowEndChatConfirmation}>
        <DialogContent 
          className="sm:max-w-md"
          aria-describedby="end-chat-description"
        >
          <DialogHeader>
            <DialogTitle>End this conversation?</DialogTitle>
            <DialogDescription id="end-chat-description">
              This will end the chat for both you and {partnerUsername || "your partner"}. 
              You'll be asked to share a quick reflection afterwards.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => setShowEndChatConfirmation(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleEndChatConfirm}
              disabled={isEndingChat}
            >
              Yes, end chat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Post-Chat Dialog - handles both user-ended and partner-left */}
      <PostChatDialog
        open={showPostChatDialog}
        onNewConversation={handlePostChatNewConversation}
        onReturnHome={handlePostChatReturnHome}
        onClose={handlePostChatClose}
        variant={isUserInitiatedEnd ? 'user-ended' : 'partner-left'}
        partnerUsername={partnerUsername}
        onReflection={!isUserInitiatedEnd ? handlePartnerLeftReflection : undefined}
      />

      {/* Header */}
      <ChatHeader
        roomStatus={roomStatus}
        connectionStatus={connectionStatus}
        partnerUsername={partnerUsername}
        partnerAvatar={partnerAvatar}
        currentUsername={session?.username}
        currentAvatar={session?.avatar}
        isEndingChat={isEndingChat}
        messages={messages}
        roomId={roomId}
        sessionExpiry={session?.expires_at}
        onShowPrompt={handleShowPrompt}
        onReport={handleReport}
        onNewMatch={() => setShowNewMatchDialog(true)}
        onEndChat={handleEndChatClick}
      />

      <ConnectionStatusBanner status={connectionStatus} />

      {/* Session Expiry Warning */}
      {session?.expires_at && (
        <div className="px-4 pt-2">
          <SessionExpiryWarning expiresAt={session.expires_at} />
        </div>
      )}

      {/* Expiry Banner */}
      {showExpiryBanner && roomStatus === "active" && (
        <div className="px-4 pt-2">
          <Alert className="border-muted">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Messages automatically disappear after 60 seconds for privacy.
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Messages */}
      <main 
        className="flex-1 overflow-y-auto" 
        style={{
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch',
        }}
        role="main"
        aria-label="Chat messages"
        aria-live="polite"
        aria-atomic="false"
      >
        {/* Max-width container for better readability on wide screens */}
        <div className="max-w-3xl mx-auto p-4 space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground text-sm animate-pulse">
                Loading messages…
              </p>
            </div>
          )}
          
          {!loading && messages.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              <p>Say hello to start the conversation</p>
            </div>
          )}
          
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              sender={message.sender}
              text={message.text}
              fading={message.fading}
              remaining={message.remaining}
              pending={message.pending}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input */}
      <footer 
        className="sticky bottom-0 border-t border-border bg-card z-10" 
        style={{
          paddingBottom: `max(1rem, env(safe-area-inset-bottom))`,
        }}
        role="contentinfo"
      >
        <div className="p-4">
          {roomStatus === "ended" ? (
            <div className="text-center text-muted-foreground py-4">
              <p>Conversation has ended</p>
            </div>
          ) : (
            <>
              {partnerTyping && (
                <div className="max-w-4xl mx-auto">
                  <div className="text-sm text-muted-foreground mb-3 py-2 animate-pulse" aria-live="polite" role="status">
                    {partnerUsername} is typing...
                  </div>
                </div>
              )}
              <ChatInput
                inputText={inputText}
                onInputChange={(text) => {
                  setInputText(text);
                  if (text.length > 0) {
                    announceTyping();
                  }
                }}
                onSend={handleSend}
                disabled={roomStatus === "ended" || connectionStatus !== "connected"}
                queuedCount={queuedCount}
                isProcessing={isQueueProcessing}
              />
            </>
          )}
        </div>

        {/* Footer Links */}
        <div className="border-t border-border py-2 px-4">
          <Footer 
            variant="chat" 
            onReportClick={() => setShowReportSheet(true)}
            onPrivacyRequestsClick={() => setShowPrivacySheet(true)}
          />
        </div>
      </footer>

      <QuickReportSheet open={showReportSheet} onOpenChange={setShowReportSheet} />
      <PrivacyRequestsSheet open={showPrivacySheet} onOpenChange={setShowPrivacySheet} />
    </div>
  );
};

export default Chat;
