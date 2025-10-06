import { useRef } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VALIDATION } from "@/config/constants";

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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <form 
      className="space-y-2 max-w-4xl mx-auto"
      onSubmit={(e) => {
        e.preventDefault();
        onSend();
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
          placeholder={disabled ? "Cannot send messages..." : "Type your message..."}
          className="flex-1"
          maxLength={VALIDATION.MAX_MESSAGE_LENGTH}
          aria-label="Message input"
          aria-describedby="char-count"
          disabled={disabled}
        />
        <Button
          type="submit"
          onClick={onSend}
          disabled={!inputText.trim() || disabled}
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
