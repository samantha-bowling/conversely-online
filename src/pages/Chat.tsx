import { useState, useEffect } from "react";
import { useNavigate, Link, useParams, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { toast } from "sonner";
import { validateMessage } from "@/lib/validation";
import { isUuid } from "@/lib/validation-utils";
import { handleApiError } from "@/lib/error-handler";
import { getRandomPrompt } from "@/config/prompts";
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from "@/config/constants";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChatGuidelines } from "@/components/chat/ChatGuidelines";
import { ChatPromptDialog } from "@/components/chat/ChatPromptDialog";
import { ReflectionDialog } from "@/components/chat/ReflectionDialog";
import { ConnectionStatusBanner } from "@/components/chat/ConnectionStatusBanner";
import { PostChatDialog } from "@/components/chat/PostChatDialog";
import { useChatRoom } from "@/hooks/useChatRoom";
import { useChatMessages } from "@/hooks/useChatMessages";
import { useTypingPresence } from "@/hooks/useTypingPresence";
import { useRealtimeConnection } from "@/hooks/useRealtimeConnection";
import { useSessionExpiry } from "@/hooks/useSessionExpiry";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Info } from "lucide-react";
import type { SendMessageResponse, EndChatResponse, BlockUserResponse } from '@/types';
import { Footer } from "@/components/Footer";
import { QuickReportSheet } from "@/components/QuickReportSheet";

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
  const [isSending, setIsSending] = useState(false);
  const [isEndingChat, setIsEndingChat] = useState(false);
  const [showReportSheet, setShowReportSheet] = useState(false);
  const [showReflectionDialog, setShowReflectionDialog] = useState(false);
  const [showNewMatchDialog, setShowNewMatchDialog] = useState(false);
  const [showPartnerLeftDialog, setShowPartnerLeftDialog] = useState(false);
  const [showPostChatDialog, setShowPostChatDialog] = useState(false);

  const { 
    roomStatus, 
    partnerUsername, 
    partnerAvatar, 
    statusAnnouncement, 
    setStatusAnnouncement,
    setIsUserInitiatedEnd,
    isUserInitiatedEnd 
  } = useChatRoom(roomId);
  
  // Monitor session expiry
  useSessionExpiry(session?.expires_at || null);
  const { messages, messageAnnouncement, messagesEndRef, messagesChannel, loading, setMessages } = useChatMessages(roomId);
  const { partnerTyping, announceTyping } = useTypingPresence(
    roomId, 
    { id: session?.id || "", name: session?.username || "Anonymous" }
  );
  const connectionStatus = useRealtimeConnection(messagesChannel);

  // Auto-hide expiry banner after first message
  useEffect(() => {
    if (messages.length > 0) {
      const timer = setTimeout(() => setShowExpiryBanner(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [messages.length]);

  const handleSend = async () => {
    if (!inputText.trim() || !roomId || !session || isSending) return;

    const messageText = inputText.trim();
    
    // Client-side validation
    const validation = validateMessage(messageText);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    setInputText("");
    setIsSending(true);

    try {
      const { data, error } = await supabase.functions.invoke<SendMessageResponse>('send-message', {
        body: {
          room_id: roomId,
          content: messageText,
        },
      });

      if (error) {
        handleApiError(error, ERROR_MESSAGES.SEND_MESSAGE_FAILED);
        setInputText(messageText);
        return;
      }

      if (!data?.success) {
        toast.error(ERROR_MESSAGES.SEND_MESSAGE_FAILED);
        setInputText(messageText);
      }
    } catch (error) {
      handleApiError(error, ERROR_MESSAGES.SEND_MESSAGE_FAILED);
      setInputText(messageText);
    } finally {
      setIsSending(false);
    }
  };

  const handleEndChat = async () => {
    if (!roomId || !session || isEndingChat) return;

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

    try {
      const { error } = await supabase.functions.invoke('submit-reflection', {
        body: {
          room_id: roomId,
          rating,
          feedback: feedback.trim() || null,
        },
      });

      if (error) {
        console.error('Failed to submit reflection:', error);
        // Don't block navigation on reflection submission failure
      } else {
        toast.success('Thank you for your feedback!');
      }
    } catch (error) {
      console.error('Error submitting reflection:', error);
    } finally {
      setShowReflectionDialog(false);
      setShowPostChatDialog(true); // Show modal instead of direct navigation
    }
  };

  const handleReflectionSkip = () => {
    setShowReflectionDialog(false);
    setShowPostChatDialog(true); // Show modal instead of direct navigation
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

  // Show partner left dialog when room ends and it wasn't initiated by current user
  useEffect(() => {
    if (roomStatus === "ended" && !isUserInitiatedEnd) {
      setShowPartnerLeftDialog(true);
    }
  }, [roomStatus, isUserInitiatedEnd]);

  return (
    <div className="h-screen flex flex-col bg-background">
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

      {/* Reflection Dialog */}
      <ReflectionDialog
        open={showReflectionDialog}
        onOpenChange={setShowReflectionDialog}
        onSubmit={handleReflectionSubmit}
        onSkip={handleReflectionSkip}
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

      {/* Partner Left Dialog */}
      <Dialog open={showPartnerLeftDialog} onOpenChange={setShowPartnerLeftDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Your partner has left the conversation</DialogTitle>
            <DialogDescription>
              Would you like to find a new match or return home?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => navigate("/matching")}>
              Find New Match
            </Button>
            <Button variant="ghost" onClick={() => navigate("/")}>
              Go Home
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Post-Chat Dialog */}
      <PostChatDialog
        open={showPostChatDialog}
        onNewConversation={handlePostChatNewConversation}
        onReturnHome={handlePostChatReturnHome}
        onClose={handlePostChatClose}
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
        onShowPrompt={handleShowPrompt}
        onReport={handleReport}
        onNewMatch={() => setShowNewMatchDialog(true)}
        onEndChat={handleEndChat}
      />

      <ConnectionStatusBanner status={connectionStatus} />

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
        className="flex-1 overflow-y-auto p-4 space-y-4" 
        role="main" 
        aria-label="Chat messages"
        aria-live="polite"
        aria-atomic="false"
      >
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
      </main>

      {/* Input */}
      <footer className="border-t border-border bg-card" role="contentinfo">
        <div className="p-4">
          {roomStatus === "ended" ? (
            <div className="text-center text-muted-foreground py-4">
              <p>Conversation has ended</p>
            </div>
          ) : (
            <>
              {partnerTyping && (
                <div className="text-sm text-muted-foreground mb-2 animate-pulse" aria-live="polite">
                  {partnerUsername} is typing...
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
                disabled={roomStatus === "ended" || isSending || connectionStatus !== "connected"}
              />
            </>
          )}
        </div>

        {/* Footer Links */}
        <div className="border-t border-border py-2 px-4">
          <Footer variant="chat" onReportClick={() => setShowReportSheet(true)} />
        </div>
      </footer>

      <QuickReportSheet open={showReportSheet} onOpenChange={setShowReportSheet} />
    </div>
  );
};

export default Chat;
