import { Button } from "@/components/ui/button";
import { Lightbulb, Wifi, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ConnectionStatus } from "@/hooks/useRealtimeConnection";

interface ChatHeaderProps {
  roomStatus: string;
  connectionStatus: ConnectionStatus;
  partnerUsername: string;
  partnerAvatar: string;
  currentUsername?: string;
  currentAvatar?: string;
  isEndingChat?: boolean;
  onShowPrompt: () => void;
  onBlock: () => void;
  onEndChat: () => void;
}

export const ChatHeader = ({ 
  roomStatus,
  connectionStatus,
  partnerUsername,
  partnerAvatar,
  currentUsername = "You",
  currentAvatar = "👤",
  isEndingChat = false,
  onShowPrompt, 
  onBlock, 
  onEndChat 
}: ChatHeaderProps) => {
  const getConnectionBadge = () => {
    if (roomStatus === "ended") {
      return (
        <Badge variant="secondary" className="gap-1">
          <WifiOff className="w-3 h-3" aria-hidden="true" />
          Disconnected
        </Badge>
      );
    }

    switch (connectionStatus) {
      case "connected":
        return (
          <Badge variant="secondary" className="gap-1 text-xs">
            <Wifi className="w-3 h-3" aria-hidden="true" />
            Connected
          </Badge>
        );
      case "reconnecting":
        return (
          <Badge variant="secondary" className="gap-1 animate-pulse">
            <Wifi className="w-3 h-3" aria-hidden="true" />
            Reconnecting...
          </Badge>
        );
      case "offline":
        return (
          <Badge variant="destructive" className="gap-1">
            <WifiOff className="w-3 h-3" aria-hidden="true" />
            Offline
          </Badge>
        );
    }
  };

  return (
    <header className="border-b border-border p-4 bg-card" role="banner">
      <div className="flex items-center justify-between mb-3">
        {/* Left: User info hierarchy */}
        <div className="flex flex-col">
          <div className="text-sm font-medium">
            You: {currentAvatar} {currentUsername}
          </div>
          <div className="text-xs text-muted-foreground">
            chatting with {partnerAvatar} {partnerUsername}
          </div>
        </div>
        
        {/* Right: Subtle status badge */}
        <div role="status" aria-live="polite">
          {getConnectionBadge()}
        </div>
      </div>

      {/* Action buttons row */}
      <nav className="flex gap-2 justify-end" aria-label="Chat controls">
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
          disabled={roomStatus === "ended" || isEndingChat}
          aria-label="End conversation"
        >
          {isEndingChat ? "Ending..." : "End Chat"}
        </Button>
      </nav>
    </header>
  );
};
