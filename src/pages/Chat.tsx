import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [showGuidelines, setShowGuidelines] = useState(true);
  const [showPromptDialog, setShowPromptDialog] = useState(false);
  const [currentPrompt] = useState(() => 
    ICEBREAKER_PROMPTS[Math.floor(Math.random() * ICEBREAKER_PROMPTS.length)]
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Start message fading after 10 seconds
  useEffect(() => {
    const fadeTimers = messages.map((msg, index) => {
      return setTimeout(() => {
        setMessages(prev => 
          prev.map(m => m.id === msg.id ? { ...m, fading: true } : m)
        );
      }, 10000 + (index * 1000)); // Stagger fading
    });

    return () => fadeTimers.forEach(clearTimeout);
  }, [messages]);

  const handleSend = () => {
    if (!inputText.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      sender: "me",
      text: inputText,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, newMessage]);
    setInputText("");

    // Simulate other person's response (for demo)
    setTimeout(() => {
      const response: Message = {
        id: (Date.now() + 1).toString(),
        sender: "other",
        text: "That's an interesting perspective. I see it differently because...",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, response]);
    }, 2000);
  };

  const handleEndChat = () => {
    navigate("/reflection");
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
          <div className="text-xs text-muted-foreground">Connected</div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPromptDialog(true)}
            className="gap-2"
          >
            <Lightbulb className="w-4 h-4" />
            Prompt
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleEndChat}
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
        <div className="flex gap-2 max-w-4xl mx-auto">
          <Input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type your message..."
            className="flex-1"
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
      </div>
    </div>
  );
};

export default Chat;
