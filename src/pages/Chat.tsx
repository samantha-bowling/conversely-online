import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Send, AlertCircle, Lightbulb } from "lucide-react";
import { ConversationButton } from "@/components/ConversationButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { toast } from "sonner";
import { validateMessage } from "@/lib/validation";

interface Message {
  id: string;
  sender: "me" | "other";
  text: string;
  timestamp: Date;
  fading?: boolean;
}

const ICEBREAKER_PROMPTS = [
  "What's one thing that surprised you in the past year?",
  "What matters most to you in your daily life?",
  "What's a belief you've changed your mind about?",
];

const Chat = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [showGuidelines, setShowGuidelines] = useState(true);
  const [showPromptDialog, setShowPromptDialog] = useState(false);
  const [currentPrompt] = useState(() => 
    ICEBREAKER_PROMPTS[Math.floor(Math.random() * ICEBREAKER_PROMPTS.length)]
  );
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomStatus, setRoomStatus] = useState<string>("active");
  const [partnerSessionId, setPartnerSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fadeTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Initialize room
  useEffect(() => {
    const state = location.state as { room_id?: string };
    const room_id = state?.room_id;

    if (!room_id || !session) {
      toast.error("No active conversation found");
      navigate("/");
      return;
    }

    setRoomId(room_id);
    
    // Fetch room details
    const fetchRoom = async () => {
      const { data, error } = await supabase.functions.invoke('get-room-data', {
        body: {
          session_id: session.id,
          room_id: room_id,
        },
      });

      if (error || !data) {
        toast.error("Room not found");
        navigate("/");
        return;
      }

      if (data.status === "ended") {
        navigate("/");
        return;
      }

      setRoomStatus(data.status);
      setPartnerSessionId(data.partner_id);
    };

    fetchRoom();
  }, [location, session, navigate]);

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
          const newMsg = payload.new;
          const sender = newMsg.session_id === session?.id ? "me" : "other";
          
          const message: Message = {
            id: newMsg.id,
            sender,
            text: newMsg.content,
            timestamp: new Date(newMsg.created_at),
            fading: false,
          };

          setMessages((prev) => [...prev, message]);

          // Start fade timer (40 seconds)
          const fadeTimer = setTimeout(() => {
            setMessages((prev) =>
              prev.map((m) => (m.id === message.id ? { ...m, fading: true } : m))
            );
          }, 40000);

          fadeTimersRef.current.set(message.id, fadeTimer);

          // Auto-delete after 60 seconds (handled by DB, but clean up UI)
          setTimeout(() => {
            setMessages((prev) => prev.filter((m) => m.id !== message.id));
            const timer = fadeTimersRef.current.get(message.id);
            if (timer) clearTimeout(timer);
            fadeTimersRef.current.delete(message.id);
          }, 60000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      fadeTimersRef.current.forEach((timer) => clearTimeout(timer));
      fadeTimersRef.current.clear();
    };
  }, [roomId, session]);

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
            toast.info("Conversation ended");
            setTimeout(() => {
              navigate("/");
            }, 2000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, navigate]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim() || !roomId || !session) return;

    const messageText = inputText.trim();
    
    // Client-side validation
    const validation = validateMessage(messageText);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    setInputText("");

    try {
      const { data, error } = await supabase.functions.invoke('send-message', {
        body: {
          session_id: session.id,
          room_id: roomId,
          content: messageText,
        },
      });

      if (error) {
        console.error("Error sending message:", error);
        
        // Handle specific error cases
        if (error.message?.includes('Rate limit exceeded')) {
          toast.error('Please slow down - you\'re sending messages too quickly');
        } else if (error.message?.includes('inappropriate content')) {
          toast.error('Message contains inappropriate content');
        } else {
          toast.error("Failed to send message");
        }
        
        setInputText(messageText);
        return;
      }

      if (!data?.success) {
        console.error("Failed to send message");
        toast.error("Failed to send message");
        setInputText(messageText);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
      setInputText(messageText);
    }
  };

  const handleEndChat = async () => {
    if (!roomId || !session) return;

    try {
      const { data, error } = await supabase.functions.invoke('end-chat', {
        body: {
          session_id: session.id,
          room_id: roomId,
        },
      });

      if (error) {
        console.error("Error ending chat:", error);
        toast.error("Failed to end chat");
        return;
      }

      if (data?.success) {
        navigate("/");
      }
    } catch (error) {
      console.error("Error ending chat:", error);
      toast.error("Failed to end chat");
    }
  };

  const handleBlock = async () => {
    if (!roomId || !session) return;

    try {
      const { data, error } = await supabase.functions.invoke('block-user', {
        body: {
          session_id: session.id,
          room_id: roomId,
        },
      });

      if (error) {
        console.error("Error blocking user:", error);
        
        if (error.message?.includes('Rate limit exceeded')) {
          toast.error('Too many blocks - please wait before blocking again');
        } else {
          toast.error("Failed to block user");
        }
        return;
      }

      if (data?.success) {
        toast.success("User blocked and chat ended");
        navigate("/");
      }
    } catch (error) {
      console.error("Error blocking user:", error);
      toast.error("Failed to block user");
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Guidelines Dialog */}
      <Dialog open={showGuidelines} onOpenChange={setShowGuidelines}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Before you begin</DialogTitle>
            <DialogDescription className="space-y-3 pt-2">
              <p className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0 text-primary" />
                <span>Don't share personal information</span>
              </p>
              <p className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0 text-primary" />
                <span>Keep it respectful and curious</span>
              </p>
              <p className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0 text-primary" />
                <span>Messages fade after a few moments</span>
              </p>
            </DialogDescription>
            <ConversationButton
              variant="primary"
              onClick={() => setShowGuidelines(false)}
              className="mt-4"
            >
              Start Conversation
            </ConversationButton>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      {/* Prompt Dialog */}
      <Dialog open={showPromptDialog} onOpenChange={setShowPromptDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conversation Prompt</DialogTitle>
            <DialogDescription className="pt-4 text-base">
              {currentPrompt}
            </DialogDescription>
            <Button
              variant="outline"
              onClick={() => setShowPromptDialog(false)}
              className="mt-4"
            >
              Close
            </Button>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="border-b border-border p-4 flex items-center justify-between bg-card">
        <div>
          <div className="font-bold">Anonymous</div>
          <div className="text-xs text-muted-foreground">
            {roomStatus === "ended" ? "Disconnected" : "Connected"}
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPromptDialog(true)}
            className="gap-2"
            disabled={roomStatus === "ended"}
          >
            <Lightbulb className="w-4 h-4" />
            Prompt
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleBlock}
            disabled={roomStatus === "ended"}
          >
            Block
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleEndChat}
            disabled={roomStatus === "ended"}
          >
            End Chat
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            <p>Say hello to start the conversation</p>
          </div>
        )}
        
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.sender === "me" ? "justify-end" : "justify-start"} ${
              message.fading ? "animate-fade-dissolve" : "animate-fade-in-gentle"
            }`}
          >
            <div
              className={`max-w-[70%] rounded-lg p-3 ${
                message.sender === "me"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground"
              }`}
            >
              <p className="text-sm">{message.text}</p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-4 bg-card">
        {roomStatus === "ended" ? (
          <div className="text-center text-muted-foreground py-4">
            <p>Conversation has ended</p>
          </div>
        ) : (
          <div className="space-y-2 max-w-4xl mx-auto">
            <div className="flex gap-2">
              <Input
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSend()}
                placeholder="Type your message..."
                className="flex-1"
                maxLength={500}
              />
              <Button
                onClick={handleSend}
                disabled={!inputText.trim()}
                size="icon"
                className="bg-primary hover:bg-primary/90"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <div className="text-xs text-muted-foreground text-right">
              {inputText.length}/500
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;
