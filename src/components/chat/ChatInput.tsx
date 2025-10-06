import { useRef, useState, useEffect } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VALIDATION } from "@/config/constants";
import { toast } from "sonner";

interface ChatInputProps {
  inputText: string;
  onInputChange: (text: string) => void;
  onSend: () => void;
  disabled?: boolean;
}

export const ChatInput = ({ 
  inputText, 
  onInputChange, 
  onSend,
  disabled = false 
}: ChatInputProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [canSendFirstMessage, setCanSendFirstMessage] = useState(false);
  const [hasSentMessage, setHasSentMessage] = useState(false);

  // First message delay (3 seconds) to break automation
  useEffect(() => {
    const timer = setTimeout(() => {
      setCanSendFirstMessage(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleSend = () => {
    if (!hasSentMessage && !canSendFirstMessage) {
      toast.error("Please wait a moment before sending your first message...");
      return;
    }
    setHasSentMessage(true);
    onSend();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const clipboardData = e.clipboardData;
    
    // Block image paste
    if (clipboardData.files.length > 0) {
      e.preventDefault();
      toast.error("Image sharing is not supported");
      return;
    }

    // Check for URLs in pasted text
    const pastedText = clipboardData.getData('text');
    if (/https?:\/\/|www\./i.test(pastedText)) {
      e.preventDefault();
      toast.error("Sharing links is not allowed");
      return;
    }
  };

  return (
    <form 
      className="space-y-2 max-w-4xl mx-auto"
      onSubmit={(e) => {
        e.preventDefault();
        handleSend();
      }}
      aria-label="Send message form"
    >
      <div className="flex gap-2">
        <label htmlFor="message-input" className="sr-only">
          Type your message
        </label>
        <Input
          id="message-input"
          ref={inputRef}
          value={inputText}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={disabled ? "Cannot send messages..." : "Type your message..."}
          className="flex-1"
          maxLength={VALIDATION.MAX_MESSAGE_LENGTH}
          aria-label="Message input"
          aria-describedby="char-count"
          disabled={disabled}
        />
        <Button
          type="submit"
          onClick={handleSend}
          disabled={!inputText.trim() || disabled || (!hasSentMessage && !canSendFirstMessage)}
          size="icon"
          className="bg-primary hover:bg-primary/90"
          aria-label="Send message"
        >
          <Send className="w-4 h-4" aria-hidden="true" />
        </Button>
      </div>
      <div id="char-count" className="text-xs text-muted-foreground text-right" aria-live="polite">
        {inputText.length}/{VALIDATION.MAX_MESSAGE_LENGTH} characters
      </div>
    </form>
  );
};
