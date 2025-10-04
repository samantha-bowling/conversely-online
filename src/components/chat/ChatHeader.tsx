import { Button } from "@/components/ui/button";
import { Lightbulb } from "lucide-react";

interface ChatHeaderProps {
  roomStatus: string;
  onShowPrompt: () => void;
  onBlock: () => void;
  onEndChat: () => void;
}

export const ChatHeader = ({ 
  roomStatus, 
  onShowPrompt, 
  onBlock, 
  onEndChat 
}: ChatHeaderProps) => {
  return (
    <header className="border-b border-border p-4 flex items-center justify-between bg-card" role="banner">
      <div>
        <div className="font-bold">Anonymous</div>
        <div className="text-xs text-muted-foreground" role="status" aria-live="polite">
          {roomStatus === "ended" ? "Disconnected" : "Connected"}
        </div>
      </div>
      <nav className="flex gap-2" aria-label="Chat controls">
        <Button
          variant="ghost"
          size="sm"
          onClick={onShowPrompt}
          className="gap-2"
          disabled={roomStatus === "ended"}
          aria-label="Show conversation prompt"
        >
          <Lightbulb className="w-4 h-4" aria-hidden="true" />
          Prompt
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onBlock}
          disabled={roomStatus === "ended"}
          aria-label="Block user and end conversation"
        >
          Block
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={onEndChat}
          disabled={roomStatus === "ended"}
          aria-label="End conversation"
        >
          End Chat
        </Button>
      </nav>
    </header>
  );
};
