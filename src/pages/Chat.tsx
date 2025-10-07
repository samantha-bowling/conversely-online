import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { toast } from "sonner";
import { validateMessage } from "@/lib/validation";
import { handleApiError } from "@/lib/error-handler";
import { getRandomPrompt } from "@/config/prompts";
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from "@/config/constants";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChatGuidelines } from "@/components/chat/ChatGuidelines";
import { ChatPromptDialog } from "@/components/chat/ChatPromptDialog";
import { ConnectionStatusBanner } from "@/components/chat/ConnectionStatusBanner";
import { useChatRoom } from "@/hooks/useChatRoom";
import { useChatMessages } from "@/hooks/useChatMessages";
import { useTypingPresence } from "@/hooks/useTypingPresence";
import { useRealtimeConnection } from "@/hooks/useRealtimeConnection";
import { useSessionExpiry } from "@/hooks/useSessionExpiry";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import type { SendMessageResponse, EndChatResponse, BlockUserResponse } from '@/types';

const Chat = () => {
  const navigate = useNavigate();
  const { session } = useSession();
  const [inputText, setInputText] = useState("");
  const [showGuidelines, setShowGuidelines] = useState(true);
  const [showPromptDialog, setShowPromptDialog] = useState(false);
  const [currentPrompt] = useState(getRandomPrompt);
  const [showExpiryBanner, setShowExpiryBanner] = useState(true);
  const [isSending, setIsSending] = useState(false);

  const { roomId, roomStatus, partnerUsername, partnerAvatar, statusAnnouncement, setStatusAnnouncement } = useChatRoom();
  
  // Monitor session expiry
  useSessionExpiry(session?.expires_at || null);
  const { messages, messageAnnouncement, messagesEndRef, messagesChannel } = useChatMessages(roomId);
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
          session_id: session.id,
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
    if (!roomId || !session) return;

    try {
      const { data, error } = await supabase.functions.invoke<EndChatResponse>('end-chat', {
        body: {
          session_id: session.id,
          room_id: roomId,
        },
      });

      if (error) {
        handleApiError(error, ERROR_MESSAGES.END_CHAT_FAILED);
        return;
      }

      if (data?.success) {
        navigate("/");
      }
    } catch (error) {
      handleApiError(error, ERROR_MESSAGES.END_CHAT_FAILED);
    }
  };

  const handleBlock = async () => {
    if (!roomId || !session) return;

    try {
      const { data, error } = await supabase.functions.invoke<BlockUserResponse>('block-user', {
        body: {
          session_id: session.id,
          room_id: roomId,
        },
      });

      if (error) {
        handleApiError(error, ERROR_MESSAGES.BLOCK_USER_FAILED);
        return;
      }

      if (data?.success) {
        toast.success(SUCCESS_MESSAGES.USER_BLOCKED);
        navigate("/");
      }
    } catch (error) {
      handleApiError(error, ERROR_MESSAGES.BLOCK_USER_FAILED);
    }
  };

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
      />

      {/* Header */}
      <ChatHeader
        roomStatus={roomStatus}
        connectionStatus={connectionStatus}
        partnerUsername={partnerUsername}
        partnerAvatar={partnerAvatar}
        onShowPrompt={() => setShowPromptDialog(true)}
        onBlock={handleBlock}
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
        {messages.length === 0 && (
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
          <div className="text-center text-xs text-muted-foreground space-x-2">
            <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <span>•</span>
            <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <span>•</span>
            <Link to="/report" className="hover:text-foreground transition-colors">Report</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Chat;
